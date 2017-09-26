'use strict'

const dataGenerator = require('../data-generator')
const errorBuilder = require('../error-builder')
const MysqlHelper = require('../mysql-helper')
const Q = require('q')
Q.longStackSupport = true

const httpResponses = require('../../etc/http-status-responses.json')

const MaxNewPiiFields = 10000
const MaxTotalPiiFields = 100000
const MaxNonPiiFields = 100000

const nonPiiDataConverters = {
    "phony_latitude": dataGenerator.toLatLong,
    "phony_longitude": dataGenerator.toLatLong,
    "phony_hash": dataGenerator.toHashKeepLength,
    "phony_loremipsum": dataGenerator.toLoremIpsum,
    "phony_password": dataGenerator.getRandomPassword,
    "phony_xml": dataGenerator.toLoremIpsumXml,
    "phony_": dataGenerator.toLatLong
}

const getAnonymizedDataByRows = (colDescriptors, anonymizedData) => {
    const columnWiseTable = colDescriptors.map((col) => {
        return [col.name].concat(anonymizedData[col.name])
    })

    return transposeMatrix(columnWiseTable)
}

const sortColsByIndex = (colDescriptorContainers) => {
    const colDescriptors = colDescriptorContainers.pii.concat(colDescriptorContainers.nonPii,
        colDescriptorContainers.extra)

    colDescriptors.sort((a, b) => {
        return a.index - b.index
    })

    return colDescriptors
}

const getAnonymizedMatrix = (piiData, nonPiiData, extraData, colDescriptors) => {
    const anonymizedData = Object.assign({}, piiData, nonPiiData, extraData)

    return getAnonymizedDataByRows(colDescriptors, anonymizedData)
}

const processExtraData = (dataColumns, extraColDescriptors) => {
    console.log("Processing extra fields")

    return extraColDescriptors.reduce((map, col) => {
        map[col.name] = dataColumns[col.name]
        return map
    }, {})
}

const verifyNonPiiFields = (nonPiiCols, dataMap) => {
    const size = nonPiiCols.reduce((totalSize, col) => {
        const colSize = dataMap[col.name].length
        return colSize + totalSize
    }, 0)

    if (size > MaxNonPiiFields) {
        throw errorBuilder.create(
            httpResponses.REQUEST_ENTITY_TOO_LARGE.status,
            httpResponses.REQUEST_ENTITY_TOO_LARGE.source,
            httpResponses.REQUEST_ENTITY_TOO_LARGE.description,
            `The number non-pii fields cannot exceed ${MaxNonPiiFields}. ` +
            `Request contains ${size}.`
        )
    }
}

const processNonPiiData = (dataColumns, nonPiiColDescriptors) => {
    console.log("Processing non pii fields")

    verifyNonPiiFields(nonPiiColDescriptors, dataColumns)

    return nonPiiColDescriptors.reduce((map, col) => {
        map[col.name] = convertArray(dataColumns[col.name],
            col.convertFunction, col.options)
        return map
    }, {})
}

const getLookupTableForHashValues = (hashedData, lookupTable, mysqlHelper) => {
    return getLookupTable(hashedData, lookupTable, mysqlHelper)
        .then((rows) => {
            return rows.reduce((map, row) => {
                map[row.PIIHashValue] = row.PhonyValue
                return map
            }, {})
        })
}

const getPhonyValuesForHashValues = (hashes, lookupTable, mysqlHelper) => {
    return getLookupTableForHashValues(hashes, lookupTable, mysqlHelper)
        .then((phonyLookup) => {
            return hashes.map((hash) => {
                if (hash) {
                    return phonyLookup[hash]
                }
                return hash
            })
        })
}

const getPhonyValuesByCol = (hashMap, piiCols, mysqlHelper) => {
    const phonyDataMap = {}
    const promises = piiCols.map((col) => {
        return getPhonyValuesForHashValues(hashMap[col.name], col.lookupTable, mysqlHelper)
            .then((phonyData) => {
                phonyDataMap[col.name] = phonyData
            })
    })

    return Q.all(promises)
        .then(() => {
            return phonyDataMap
        })
}

const getPiiInsertQueries = (hashes, lookupTable, phonyTable) => {
    const insertPhonyLookupQuery = [
        `INSERT INTO ${lookupTable} (PIIHashValue, PhonyValue)`,
        `SELECT ?, ${phonyTable}.PhonyValue`,
        `FROM ${phonyTable}`,
        `WHERE NOT EXISTS(`,
        `SELECT * FROM phony_mi_lookup WHERE PIIHashValue = ?`,
        `) LIMIT 1`
    ].join(" ")

    const deletePhonyQuery = [
        `DELETE FROM ${phonyTable}`,
        `WHERE PhonyValue = (SELECT PhonyValue FROM ${lookupTable} WHERE PIIHashValue = ?)`
    ].join(" ")

    return hashes.reduce((queries, hash) => {
        queries.sql.push(insertPhonyLookupQuery, deletePhonyQuery)
        queries.values.push(hash, hash, hash)

        return queries
    }, { sql: [], values: [] } )
}

const verifyPhonyValueCount = (hashValueCount, phonyTable, mysqlHelper) => {
    return mysqlHelper.getRowCount(phonyTable)
        .then((phonyCount) => {
            if (phonyCount < hashValueCount) {
                throw errorBuilder.create(
                    httpResponses.INSUFFICIENT_DATA_IN_DB.status,
                    httpResponses.INSUFFICIENT_DATA_IN_DB.source,
                    httpResponses.INSUFFICIENT_DATA_IN_DB.description,
                    `${phonyCount} remaining unused phony values in the table "${phonyTable}" ` +
                    `but need ${hashValueCount}`
                )
            }
        })
}

const getNewHashValues = (currHashes, storedHashes) => {
    if (storedHashes.length) {
        return currHashes.filter((value) => {
            return !storedHashes.includes(value)
        })
    }
    return currHashes
}

const getLookupTable = (hashValues, lookupTable, mysqlHelper) => {
    const query = [
        `SELECT * FROM ${lookupTable}`,
        'WHERE PIIHashValue IN (?)'
    ].join(' ')

    return mysqlHelper.runQuery(query, [ hashValues ])
}

const getUniqueValues = (arr) => {
    return arr.filter((value, index, self) => {
        return value && (self.indexOf(value) === index)
    })
}

const getHashValuesToAdd = (piiColDescriptor, hashedPiiArr, mysqlHelper) => {
    const uniqueHashes = getUniqueValues(hashedPiiArr)

    if (!uniqueHashes.length) {
        return
    }

    let hashValuesToAdd
    return getLookupTable(uniqueHashes, piiColDescriptor.lookupTable, mysqlHelper)
        .then((rows) => {
            const storedHashes = rows.map((value) => {
                return value.PIIHashValue
            })
            return getNewHashValues(uniqueHashes, storedHashes)
        })
        .then((newHashValues) => {
            hashValuesToAdd= newHashValues
            return verifyPhonyValueCount(hashValuesToAdd.length, piiColDescriptor.phonyTable, mysqlHelper)
        })
        .then(() => {
            return {
                pii: piiColDescriptor,
                hashValues: hashValuesToAdd
            }
        })
}

const convertArray = (arr, convertFunction, options) => {
    return arr.map((value) => {
        if (convertFunction === nonPiiDataConverters["phony_password"]) {
            return convertFunction(options.min, options.max)
        }
        return convertFunction(value)
    })
}

const verifyNewPiiData = (newPiiData) => {
    const size = newPiiData.reduce((totalSize, col) => {
        const colSize = col.hashValues.length
        return totalSize + colSize
    }, 0)

    if (size > MaxNewPiiFields) {
        throw errorBuilder.create(
            httpResponses.REQUEST_ENTITY_TOO_LARGE.status,
            httpResponses.REQUEST_ENTITY_TOO_LARGE.source,
            httpResponses.REQUEST_ENTITY_TOO_LARGE.description,
            `The number of fields to anonymize cannot exceed ${MaxNewPiiFields}. ` +
            `Request contains ${size}.`
        )
    }
}

const verifyPiiData = (piiCols, dataMap) => {
    const size = piiCols.reduce((totalSize, col) => {
        const colSize = dataMap[col.name].length
        return totalSize + colSize
    }, 0)

    if (size > MaxTotalPiiFields) {
        throw errorBuilder.create(
            httpResponses.REQUEST_ENTITY_TOO_LARGE.status,
            httpResponses.REQUEST_ENTITY_TOO_LARGE.source,
            httpResponses.REQUEST_ENTITY_TOO_LARGE.description,
            `The number of pii fields cannot exceed ${MaxTotalPiiFields}. ` +
            `Request contains ${size}.`
        )
    }
}

const processPiiData = (dataMap, piiCols, mysqlHelper) => {
    console.log("Processing pii fields")
    const hashMap = {}

    verifyPiiData(piiCols, dataMap)

    const promises = piiCols.map((col) => {
        hashMap[col.name] = convertArray(dataMap[col.name], dataGenerator.toHash)
        return getHashValuesToAdd(col, hashMap[col.name], mysqlHelper)
    })

    return Q.all(promises)
        .then((pii) => {
            verifyNewPiiData(pii)
            return pii.reduce((map, item) => {
                if (!item.hashValues.length) {
                    return map
                }
                const queries = getPiiInsertQueries(item.hashValues,
                    item.pii.lookupTable, item.pii.phonyTable)
                map.push(queries)
                return map
            }, [])
        })
        .then((piiQueries) => {
            if (piiQueries.length) {
                return piiQueries.reduce((promise, queries) => {
                    return promise
                        .then(() => {
                            const options = { retries: 10 }
                            return mysqlHelper.runTransaction(queries, options)
                        })
                }, Q.Promise.resolve())
            }
        })
        .then(() => {
            return getPhonyValuesByCol(hashMap, piiCols, mysqlHelper)
        })
}

const transposeMatrix = (arr) => {
    return arr[0].map((col, i) => {
        return arr.map((row) => {
            return row[i]
        })
    })
}

const getColumnsByColDescriptor = (columnDescriptors, rows) => {
    const cols = transposeMatrix(rows)

    return columnDescriptors.reduce((map, col, index) => {
        map[col.name] = cols[index]
        return map
    }, {})
}

const anonymizeData = (colDescriptorContainers, rows, mysqlHelper) => {
    const columnDescriptors = sortColsByIndex(colDescriptorContainers)
    const dataMap = getColumnsByColDescriptor(columnDescriptors, rows)

    return processPiiData(dataMap, colDescriptorContainers.pii, mysqlHelper)
        .then((piiData) => {
            const nonPiiData = processNonPiiData(dataMap, colDescriptorContainers.nonPii)
            const extraData = processExtraData(dataMap, colDescriptorContainers.extra)

            return getAnonymizedMatrix(piiData, nonPiiData, extraData, columnDescriptors)
        })
}

const lookupDBTableName = (columnType) => {
    return `${columnType}_lookup`
}

const phonyDBTableName = (columnType) => {
    return columnType
}

const isPiiColumn = (colType, dbTables) => {
    return dbTables.includes(phonyDBTableName(colType))
        && dbTables.includes(lookupDBTableName(colType))
}

const isNonPiiColumn = (colType) => {
    return Object.keys(nonPiiDataConverters).includes(colType)
}

const isExtraColumn = (colType) => {
    return !colType.includes('phony_')
}

const getColumnOptions = (col) => {
    const options = {}

    if (col === "phony_password" || col.type === "phony_password") {
        options.min = col.min || 8
        options.max = col.max || 20
    }

    return options
}

const getColumnDescriptor = (column, index) => {
    const columnDescriptor = {
        index
    }

    if (typeof column === 'string') {
        columnDescriptor.name = column.toLowerCase()
    }
    else if (typeof column === 'object') {
        if (!column.type) {
            const error = httpResponses.BAD_REQUEST
            error.message = `Column Descriptors must include a type. Error when processing: ${column}`
            throw error
        }

        columnDescriptor.name = column.type.toLowerCase()
    }
    else {
        const error = httpResponses.BAD_REQUEST
        error.message = `Invalid column descriptor: ${column}`
        throw error
    }

    columnDescriptor.options = getColumnOptions(column)
    return columnDescriptor
}

const getColumnDescriptorContainers = (columns, dbTables) => {
    const columnDescriptorContainers = {
        pii: [],
        nonPii: [],
        extra: []
    }

    return columns.reduce((map, item, index) => {
        const columnDescriptor = getColumnDescriptor(item, index)

        if (isExtraColumn(columnDescriptor.name)) {
            map.extra.push(columnDescriptor)
        }
        else if (isNonPiiColumn(columnDescriptor.name)) {
            columnDescriptor.convertFunction = nonPiiDataConverters[columnDescriptor.name]
            map.nonPii.push(columnDescriptor)
        }
        else if (isPiiColumn(columnDescriptor.name, dbTables)) {
            columnDescriptor.lookupTable = lookupDBTableName(columnDescriptor.name)
            columnDescriptor.phonyTable = phonyDBTableName(columnDescriptor.name)
            map.pii.push(columnDescriptor)
        }
        else {
            throw errorBuilder.create(
                httpResponses.BAD_REQUEST.status,
                httpResponses.BAD_REQUEST.source,
                `Invalid column descriptor: ${columnDescriptor.name}`
            )
        }

        return map
    }, columnDescriptorContainers)
}

const getDBTables = (mysqlHelper) => {
    const dbName = mysqlHelper.connectionDetails.database
    const query = [
        'SELECT TABLE_NAME',
        'FROM information_schema.tables',
        'WHERE table_schema = ?'
    ].join(' ')

    return mysqlHelper.runQuery(query, dbName)
        .then((results) => {
            return results.map((item) => {
                return item.TABLE_NAME
            })
        })
}

const processColDescriptors = (columns, mysqlHelper) => {
    return getDBTables(mysqlHelper)
        .then((dbTables) => {
            return getColumnDescriptorContainers(columns, dbTables)
        })
}

const stringifyIfNotEmpty = (arr) => {
    return arr.map((value) => {
        if (typeof value === 'string' || value === null || value === undefined) {
            return value
        }
        return JSON.stringify(value)
    })
}

const verifyData = (columns, rows) => {
    if (!rows) {
        return
    }

    if (!Array.isArray(columns) || !Array.isArray(rows)) {
        throw errorBuilder.create(
            httpResponses.BAD_REQUEST.status,
            httpResponses.BAD_REQUEST.source,
            "'columnDescriptors' and 'rowData' fields must be of type array"
        )
    }

    if (!columns || !columns.length) {
        throw errorBuilder.create(
            httpResponses.BAD_REQUEST.status,
            httpResponses.BAD_REQUEST.source,
            "Missing columns"
        )
    }

    rows.forEach((row) => {
        if (row.length !== columns.length) {
            throw errorBuilder.create(
                httpResponses.BAD_REQUEST.status,
                httpResponses.BAD_REQUEST.source,
                `Rows should have a value per column. The following row has `
                + `${row.length} values, but should have ${columns.length}: ${row}`
            )
        }
    })
}

const run = (columns, rows) => {

    verifyData(columns, rows)

    rows.forEach((row, index) => {
        rows[index] = stringifyIfNotEmpty(row)
    })

    let mysqlHelper
    const mysqlOptions = { multipleStatements: true }

    return MysqlHelper.create(mysqlOptions)
        .catch((error) => {
            console.log(error)
            throw errorBuilder.create(
                httpResponses.INVALID_CREDENTIALS.status,
                httpResponses.INVALID_CREDENTIALS.source,
                "Error decrypting database credentials",
                null,
                null,
                error.stack
            )
        })
        .then((helper) => {
            mysqlHelper = helper
            return mysqlHelper.createConnection()
        })
        .catch((error) => {
            if (error.status) {
                throw error
            }
            console.log(error)
            throw errorBuilder.create(
                httpResponses.CONNECTION_ERROR.status,
                httpResponses.CONNECTION_ERROR.source,
                "Error connecting to the database",
                null,
                null,
                error.stack
            )
        })
        .then(() => {
            return processColDescriptors(columns, mysqlHelper)
        })
        .then((colDescriptorContainers) => {
            return anonymizeData(colDescriptorContainers, rows, mysqlHelper)
        })
        .then((result) => {
            mysqlHelper.releaseConnection()
            return result
        })
        .catch((error) => {
            if (mysqlHelper) {
                mysqlHelper.releaseConnection()
            }
            console.log(error)
            throw error
        })

}

module.exports = {
    run,
    _testExports: {
        getAnonymizedDataByRows,
        sortColsByIndex,
        getAnonymizedMatrix,
        processExtraData,
        processNonPiiData,
        getLookupTableForHashValues,
        getPhonyValuesForHashValues,
        getPhonyValuesByCol,
        getPiiInsertQueries,
        getNewHashValues,
        getLookupTable,
        getUniqueValues,
        verifyPhonyValueCount,
        getHashValuesToAdd,
        convertArray,
        processPiiData,
        transposeMatrix,
        getColumnsByColDescriptor,
        anonymizeData,
        lookupDBTableName,
        phonyDBTableName,
        isPiiColumn,
        isNonPiiColumn,
        isExtraColumn,
        getColumnOptions,
        getColumnDescriptor,
        getColumnDescriptorContainers,
        getDBTables,
        processColDescriptors,
        stringifyIfNotEmpty,
        verifyData,
        nonPiiDataConverters
    }
}

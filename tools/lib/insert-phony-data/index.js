'use strict'

const CSV = require('csv-string')
const fs = require('fs')
const MysqlHelper = require('../../../src/lib/mysql-helper')
const path = require('path')
const Q = require('q')
const readline = require('readline')
const sql = require('../../etc/phony_database_setup_sql_scripts.json')
const stream = require('stream')

const MaxIndexSize = 10000

const insertToPhonyTable = (phonyTable, values, mysqlHelper) => {
    console.log(`Inserting ${values.length} phony values into table ${phonyTable}`)

    const insertDataQuery = sql.insertPhonyData
        .replace('?', phonyTable)

    return mysqlHelper.runQuery(insertDataQuery, [values])
}

const getFileName = (path) => {
    path = path.replace(/\\/g,'/')

    return path.substring(
        path.lastIndexOf('/') + 1,
        path.lastIndexOf('.')
    )
}

const removePhonyDuplicates = (phonyData, table, mysqlHelper) => {
    const getPhonyDuplicates = sql.selectPhonyValues
        .replace('?', `${table}`)

    return mysqlHelper.runQuery(getPhonyDuplicates, [phonyData])
        .then((rows) => {
            const duplicates = rows.map((row) => {
                return row.PhonyValue.toLowerCase()
            })

            return phonyData.filter((value) => {
                return !duplicates.includes(value.toLowerCase())
            })
        })
}

const insertPhonyData = (phonyValues, phonyTable, mysqlHelper) => {
    return removePhonyDuplicates(phonyValues, `${phonyTable}_lookup`, mysqlHelper)
        .then((data) => {
            if (data.length) {
                const values = data.map((value) => {
                    return [value]
                })

                return insertToPhonyTable(phonyTable, values, mysqlHelper)
            }
        })
}

const getUniqueValues = (arr) => {
    return arr.filter((value, index, self) => {
        return value && (self.indexOf(value) === index)
    })
}

const getCsvRow = (rowStr) => {
    const csvArr = CSV.parse(rowStr)
    return csvArr[0]
}

const getPhonyValues = (csvRows) => {
    const phonyData = csvRows.reduce((arr, row) => {
        const csvArr = getCsvRow(row)
        if (csvArr.length > 1) {
            throw new Error('Each row should contain a single value. ' +
                `The following row is invalid: ${csvArr.join()}`)
        }
        arr.push(csvArr[0].trim())
        return arr
    }, [])

    return getUniqueValues(phonyData)
}

const indexRows = (rows, table, mysqlHelper) => {
    if (!rows.length) {
        return Q.Promise.resolve()
    }
    const values = getPhonyValues(rows)

    return insertPhonyData(values, table, mysqlHelper)
}

const processPhonyData = (filePath, mysqlHelper) => {
    console.log(`Processing ${filePath}`)

    const deferred = Q.defer()

    try {
        const instream = fs.createReadStream(filePath)
        const outstream = new stream
        const rl = readline.createInterface(instream, outstream)
        const tableName = getFileName(filePath)
        const rows = []

        rl.on('line', (line) => {
            if (rows.length >= MaxIndexSize) {
                return indexRows(rows.splice(0, rows.length),
                    tableName, mysqlHelper)
            }

            rows.push(line)
        })

        rl.on('close', () => {
            return indexRows(rows.splice(0, rows.length),
                tableName, mysqlHelper)
                .then(() => {
                    deferred.resolve()
                })
        })
    }
    catch (error) {
        deferred.reject(error)
    }

    return deferred.promise
}

const verifyFileSize = (fileName, size) => {
    if ((size / 1000000) >= 250) {
        throw new Error(`File size cannot exceed ${250} MB.`)
    }
}

const cli = (opts, args) => {
    let mysqlHelper

    return MysqlHelper.create()
        .then((helper) => {
            mysqlHelper = helper
            return mysqlHelper.createConnection()
        })
        .then(() => {
            return Q.ninvoke(fs, 'readdir', args.phonyDataDir)
        })
        .then((files) => {
            return files.reduce((promise, file) => {
                return promise.then(() => {
                    const filePath = path.resolve(args.phonyDataDir, file)
                    verifyFileSize(file, fs.statSync(filePath).size)
                    return processPhonyData(filePath, mysqlHelper)
                })
            }, Q.Promise.resolve())
        })
        .then(() => {
            mysqlHelper.releaseConnection()
            console.log("Done")
        })
        .catch((error) => {
            mysqlHelper.releaseConnection()
            throw error
        })
}

module.exports = {
    cli
}

'use strict'

const anonymizerService = require('..')
const dataGenerator = require('../../data-generator')
const Q = require('q')

jest.mock('../../mysql-helper')
const mysqlHelperMock = require('../../mysql-helper')

mysqlHelperMock.runQuery = jest.fn(() => {
    return Q.Promise.resolve()
})

describe('anonymizer-service:convertArray', () => {

    it('should return the converted array with the appropriate values', () => {
        const arr = ['foo', 'bar']
        const convertFunction = dataGenerator.toLatLong

        const result = anonymizerService._testExports.convertArray(arr, convertFunction)
        expect(result).toEqual(arr)
    })

    it('should return the converted array with the appropriate values when the convert function is getRandomPassword()', () => {
        const arr = ['foo', 'bar']
        const convertFunction = dataGenerator.getRandomPassword
        const options = {
            min: 3,
            max: 10
        }

        const result = anonymizerService._testExports.convertArray(arr, convertFunction, options)

        result.forEach((value) => {
            expect(value.length >= options.min).toBeTruthy()
            expect(value.length <= options.max).toBeTruthy()
        })
    })

})

describe('anonymizer-service:searchLookupTable', () => {

    it('should call runQuery from mysqlHelper with the appropriate arguments', () => {
        const lookupTable = "phony_foo_lookup"
        const uniqueValuesArr = ['foo', 'bar']
        const lookupQuery = [
            `SELECT * FROM ${lookupTable}`,
            `WHERE PIIHashValue IN(?)`,
            'ORDER BY PIIHashValue'
        ].join(' ')

        return anonymizerService._testExports.searchLookupTable(lookupTable, uniqueValuesArr, mysqlHelperMock)
            .then(() => {
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledWith(lookupQuery, [uniqueValuesArr])
            })
    })

})

describe('anonymizer-service:getUniqueValues', () => {

    it('should return an array with the unique values for given array that has duplicates', () => {
        const arr = [ 'abc', 'def', '123', 'def', 'abc']

        const result = anonymizerService._testExports.getUniqueValues(arr)
        expect(result).toEqual(['abc', 'def', '123'])
    })

})

describe('anonymizer-service:getNewHashValues', () => {

    it('should return an array of values from the currHashes array that do not exist in the storedHashes array', () => {
        const currHashes = ['abc', 'foo', '123', 'bar', 'def']
        const storedHashes = ['abc', '123', 'def', '456']

        const result = anonymizerService._testExports.getNewHashValues(currHashes, storedHashes)
        expect(result).toEqual(['foo', 'bar'])
    })

    it('should return an empty array of values if all the values from the currHashes array exist in storedHashes', () => {
        const currHashes = ['abc', 'def']
        const storedHashes = ['123', 'abc', '456', 'def', '789']

        const result = anonymizerService._testExports.getNewHashValues(currHashes, storedHashes)
        expect(result).toEqual([])
    })

})

describe('anonymizer-service:getHashValuesToAdd', () => {

    it('should call runQuery from mysqlHelper and return the appropriate hash values', () => {
        const hashValues = ['lkc8ekc', '374dhkw', '30ejdt']
        const piiFieldInfo = {
            name: "phony_foo",
            phonyTable: "phony_foo",
            lookupTable: "phony_foo_lookup"
        }

        const expectedResult = {
            pii: piiFieldInfo,
            hashValues: hashValues
        }

        mysqlHelperMock.getRowCount = jest.fn(() => {
            return Q.Promise.resolve(5)
        })
        mysqlHelperMock.runQuery = jest.fn(() => {
            return Q.Promise.resolve([])
        })

        return anonymizerService._testExports.getHashValuesToAdd(piiFieldInfo, hashValues, mysqlHelperMock)
            .then((result) => {
                expect(result).toEqual(expectedResult)
                expect(mysqlHelperMock.runQuery).toHaveBeenCalled()
            })
    })

    it('should return an error if the db return less phony values than needed', () => {
        mysqlHelperMock.getRowCount = jest.fn(() => {
            return Q.Promise.resolve(2)
        })
        const hashValues = ['lkc8ekc', '374dhkw', '30ejdt']
        const piiFieldInfo = {
            name: "phony_foo",
            phonyTable: "phony_foo",
            lookupTable: "phony_foo_lookup"
        }
        mysqlHelperMock.runQuery = jest.fn(() => {
            return Q.Promise.resolve([])
        })

        return anonymizerService._testExports.getHashValuesToAdd(piiFieldInfo, hashValues, mysqlHelperMock)
            .then((result) => {
                //should not get here
                expect(result).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
                expect(mysqlHelperMock.runQuery).toHaveBeenCalled()
                expect(mysqlHelperMock.getRowCount).toHaveBeenCalled()
            })
    })

})

describe('anonymizer-service:queryLookupByHash', () => {

    it('should call runQuery from mysqlHelper with the appropriate query', () => {
        const lookupTable = "phony_foo_lookup"
        const query = [
            `SELECT * FROM ${lookupTable}`,
            'WHERE PIIHashValue IN (?)'
        ].join(' ')

        const hashValues = ['com30dc', 'msmv0e']

        return anonymizerService._testExports.queryLookupByHash(hashValues, lookupTable, mysqlHelperMock)
            .then(() => {
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledWith(query, [hashValues])
            })
    })

})

describe('anonymizer-service:getLookupTableForHashValues', () => {

    it('should return the appropriate hash to phony value map', () => {
        const hashedData = ['hash1', 'hash2']
        const lookupTable = "phony_foo_lookup"

        const lookupQuery = [
            `SELECT * FROM ${lookupTable}`,
            'WHERE PIIHashValue IN (?)'
        ].join(' ')

        const phonyData = [
            { PhonyValue: 'foo', PIIHashValue: hashedData[0] },
            { PhonyValue: 'bar', PIIHashValue: hashedData[1] }
        ]

        const expectedResults = {}
        expectedResults[hashedData[0]] = 'foo'
        expectedResults[hashedData[1]] = 'bar'

        mysqlHelperMock.runQuery = jest.fn((query, values) => {
            if (query === lookupQuery) {
                return Q.Promise.resolve(phonyData)
            }
            return Q.Promise.resolve()
        })

        return anonymizerService._testExports.getLookupTableForHashValues(hashedData, lookupTable, mysqlHelperMock)
            .then((result) => {
                expect(mysqlHelperMock.runQuery).toHaveBeenCalled()
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledWith(lookupQuery, [hashedData])
                expect(result).toEqual(expectedResults)
            })
    })

})

describe('anonymizer-service:isExtraColumn', () => {

    it('should return false if the header name has the string phony_ in it', () => {
        const headerName = 'phony_random'

        const result = anonymizerService._testExports.isExtraColumn(headerName)
        expect(result).toBeFalsy()
    })

    it('should return true if the header name does not have string phony_ in it', () => {
        const headerName = 'random'

        const result = anonymizerService._testExports.isExtraColumn(headerName)
        expect(result).toBeTruthy()
    })

})

describe('anonymizer-service:isNonPiiColumn', () => {

    it('should return true if the header name is a key in the nonPiiFieldConverters map', () => {
        const headerName = "phony_hash"

        const result = anonymizerService._testExports.isNonPiiColumn(headerName)
        expect(result).toBeTruthy()
    })

    it('should return false if the header name is not a key in the nonPiiFieldConverters map', () => {
        const headerName = 'phony_random'

        const result = anonymizerService._testExports.isNonPiiColumn(headerName)
        expect(result).toBeFalsy()
    })

})

describe('anonymizerService:verifyPhonyValueCount', () => {

    it('should not throw an error if the number of phony values in the database is >= the number of new hash values', () => {
        const hashValueCount = 3
        const phonyTable = "phony_foo"
        mysqlHelperMock.getRowCount = jest.fn(() => {
            return Q.Promise.resolve(5)
        })

        return anonymizerService._testExports.verifyPhonyValueCount(hashValueCount, phonyTable, mysqlHelperMock)
            .then(() => {
                expect(mysqlHelperMock.getRowCount).toHaveBeenCalled()
            })
    })

    it('should not throw an error if the number of phony values in the database is >= the number of new hash values', () => {
        const hashValueCount = 3
        const phonyTable = "phony_foo"
        mysqlHelperMock.getRowCount = jest.fn(() => {
            return Q.Promise.resolve(1)
        })

        return anonymizerService._testExports.verifyPhonyValueCount(hashValueCount, phonyTable, mysqlHelperMock)
            .then(() => {
                //should not get here
                expect(true).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

describe('anonymizer-service:isPiiColumn', () => {

    const dbTables = [
        'phony_A',
        'phony_A_lookup'
    ]

    it('should return true if the header has existing phony and lookup db tables', () => {
        const headerName = "phony_A"

        const result = anonymizerService._testExports.isPiiColumn(headerName, dbTables)
        expect(result).toBeTruthy()
    })

    it('should return false if the header does not have existing phony and lookup db tables', () => {
        const headerName = 'phony_B'

        const result = anonymizerService._testExports.isPiiColumn(headerName, dbTables)
        expect(result).toBeFalsy()
    })

})

describe('anonymizer-service:stringifyIfNotEmpty', () => {

    it('should send the original value for each value that is a string, null, or undefined', () => {
        const arr = ["abc", null, undefined]

        const result = anonymizerService._testExports.stringifyIfNotEmpty(arr)
        expect(result).toEqual(arr)
    })

    it('should send the stringified version of the each value passed in that is not empty', () => {
        const arr = [123, {}, ['a','b','c']]
        const expectedResult = [
            JSON.stringify(arr[0]),
            JSON.stringify(arr[1]),
            JSON.stringify(arr[2])
        ]

        const result = anonymizerService._testExports.stringifyIfNotEmpty(arr)
        expect(result).toEqual(expectedResult)
    })

})

describe('anonymizer-service:getColumnDescriptorContainers', () => {

    it('should return the appropriate header containers', () => {
        const headers = [
            "phony_email",
            "phony_password",
            "random"
        ]
        const dbTables = [
            "phony_email",
            "phony_email_lookup"
        ]

        const expectedResult = {
            "pii": [
                {
                    name: "phony_email",
                    index: 0,
                    phonyTable: "phony_email",
                    lookupTable: "phony_email_lookup",
                    options: {}
                }
            ],
            "nonPii": [
                {
                    name: "phony_password",
                    index: 1,
                    options: {
                        min: 8,
                        max: 20
                    },
                    convertFunction: anonymizerService._testExports.nonPiiDataConverters["phony_password"]
                }
            ],
            "extra": [
                {
                    index: 2,
                    name: "random",
                    options: {}
                }
            ]
        }

        const result = anonymizerService._testExports.getColumnDescriptorContainers(headers, dbTables)
        expect(result).toEqual(expectedResult)
    })

})

describe('anonymizer-service:transposeMatrix', () => {

    it('should return the transposed matrix', () => {
        const matrix = [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9]
        ]

        const expectedResult = [
            [1, 4, 7],
            [2, 5, 8],
            [3, 6, 9]
        ]

        const result = anonymizerService._testExports.transposeMatrix(matrix)
        expect(result).toEqual(expectedResult)
    })

})

describe('anonymizer-service:getAnonymizedDataByRows', () => {

    it('should return a transposed matrix of the anonymized data in the appropriate order', () => {
        const colDescriptors = [
            {
                name: "foo"
            },
            {
                name: "bar"
            }
        ]

        const anonymizedData = {
            bar: [ "bar1", "bar2" ],
            foo: [ "foo1", "foo2" ]
        }

        const expectedResult = [
            [ "foo", "bar" ],
            [ "foo1", "bar1" ],
            [ "foo2", "bar2" ]
        ]

        const result = anonymizerService._testExports.getAnonymizedDataByRows(colDescriptors, anonymizedData)
        expect(result).toEqual(expectedResult)
    })

})

describe('anonymizer-service:getAnonymizedMatrix', () => {

    it('should return a transposed matrix of the anonymized data in the appropriate order', () => {
        const piiData = {
            pii1: [ 'abc', 'def' ],
            pii2: [ 123, 456 ],
        }

        const nonPiiData = {
            nonPii1: [ 'foo', 'bar' ],
            nonPii2: [ 'red', 'blue' ],
        }

        const extraData = {
            extra1: [ 'A', 'B' ],
            extra2: [ 1, 2 ],
        }

        const colDescriptors = [
            {name: 'pii1'},
            {name: 'pii2'},
            {name: 'nonPii1'},
            {name: 'nonPii2'},
            {name: 'extra1'},
            {name: 'extra2'}
        ]

        const expectedResult = [
            [ 'pii1', 'pii2', 'nonPii1', 'nonPii2', 'extra1', 'extra2'],
            [ 'abc', 123, 'foo', 'red', 'A', 1 ],
            [ 'def', 456, 'bar', 'blue', 'B', 2 ]
        ]

        const result = anonymizerService._testExports.getAnonymizedMatrix(piiData, nonPiiData, extraData, colDescriptors)
        expect(result).toEqual(expectedResult)
    })

})

describe('anonymizer-service:sortColsByIndex', () => {

    it('should return the columns sorted by index', () => {
        const containers = {
            pii: [
                {
                    name: "three",
                    index: 3
                },
                {
                    name: "two",
                    index: 2
                }
            ],
            nonPii: [
                {
                    name: "zero",
                    index: 0
                },
                {
                    name: "four",
                    index: 4
                }
            ],
            extra: [
                {
                    name: "one",
                    index: 1
                },
                {
                    name: "five",
                    index: 5
                }
            ]
        }

        const expectedResult = [
            {
                name: "zero",
                index: 0
            },
            {
                name: "one",
                index: 1
            },
            {
                name: "two",
                index: 2
            },
            {
                name: "three",
                index: 3
            },
            {
                name: "four",
                index: 4
            },
            {
                name: "five",
                index: 5
            }
        ]

        const result = anonymizerService._testExports.sortColsByIndex(containers)
        expect(result).toEqual(expectedResult)
    })
})

describe('anonymizer-service:processExtraData', () => {

    it('should return a map containing only the extra columns', () => {
        const dataColumns = {
            abc: ["a", "b", "c"],
            bar: ["b", "a", "r"],
            nums: [1, 2, 3],
            foo: ["f", "o", "o"]
        }

        const extraColDescriptors = [
            {
                name: "foo"
            },
            {
                name: "bar"
            }
        ]

        const expectedResult = {
            foo: ["f", "o", "o"],
            bar: ["b", "a", "r"]
        }

        const result = anonymizerService._testExports.processExtraData(dataColumns, extraColDescriptors)
        expect(result).toEqual(expectedResult)
    })

})

describe('anonymizer-service:processNonPiiData', () => {

    it('should return a map containing only the nonPii columns', () => {
        const dataColumns = {
            abc: ["a", "b", "c"],
            bar: ["b", "a", "r"],
            nums: [1, 2, 3],
            foo: ["f", "o", "o"]
        }

        const nonPiiColDescriptors = [
            {
                name: "foo",
                convertFunction: dataGenerator.toLatLong
            },
            {
                name: "bar",
                convertFunction: dataGenerator.toLatLong
            }
        ]

        const expectedResult = {
            foo: ["f", "o", "o"],
            bar: ["b", "a", "r"]
        }

        const result = anonymizerService._testExports.processNonPiiData(dataColumns, nonPiiColDescriptors)

        expect(result).toEqual(expectedResult)
    })

})

describe('anonymizer-service:verifyData', () => {

    it('should not throw an error if rows is empty', () => {
        const result = anonymizerService._testExports.verifyData(null, null)

        expect(result).toBe(undefined)
    })

    it('should throw an error if columns is null', () => {
        const rows = [ "a", "b" ]
        const columns = null

        expect(() => {
            anonymizerService._testExports.verifyData(columns, rows)
        }).toThrow()
    })

    it('should throw an error if columns is empty', () => {
        const rows = [ "a", "b" ]
        const columns = []

        expect(() => {
            anonymizerService._testExports.verifyData(columns, rows)
        }).toThrow()
    })

    it('should throw an error if rows is not an array', () => {
        const rows = "abc"
        const columns = [ 1, 2 ]

        expect(() => {
            anonymizerService._testExports.verifyData(columns, rows)
        }).toThrow()
    })

    it('should throw an error if rows is not an array', () => {
        const columns = "abc"
        const rows = [ 1, 2 ]

        expect(() => {
            anonymizerService._testExports.verifyData(columns, rows)
        }).toThrow()
    })

})

describe('anonymizer-service:getColumnOptions', () => {

    it('should return an empty object if the column is not phony_password', () => {
        const col = "foo"

        const result = anonymizerService._testExports.getColumnOptions(col)
        expect(result).toEqual({})
    })

    it('should return an object with the default min and max values if the column is phony_password', () => {
        const col = "phony_password"
        const expectedResult = {
            min: 8,
            max: 20
        }

        const result = anonymizerService._testExports.getColumnOptions(col)
        expect(result).toEqual(expectedResult)
    })

    it('should return an object with the given min and max values if the column type is phony_password', () => {
        const col = {
            type: "phony_password",
            min: 2,
            max: 3
        }
        const expectedResult = {
            min: 2,
            max: 3
        }

        const result = anonymizerService._testExports.getColumnOptions(col)
        expect(result).toEqual(expectedResult)
    })

})

'use strict'

jest.unmock('..')
const setupDatabase = require('..')

const path = require('path')
const Q = require('q')

const mysqlHelperMock = require('../../../../src/lib/mysql-helper')
const sql = require('../../../etc/phony_database_setup_sql_scripts.json')

const runQueryMock = jest.fn(() => {
    return Q.Promise.resolve()
})

const expectedPhonyDataValues = [["the"], ["quick"], ["brown"], ["fox"], ["jumps"], ["over"], ["the"], ["lazy"], ["dog"]]

beforeEach(() => {
    runQueryMock.mockClear()
    mysqlHelperMock.runQuery = runQueryMock
})

describe('setup-database:dropTables', () => {

    it('should call runQuery from mysqlHelper with the appropriate queries', () => {
        const tableArr = [ "tableA", "tableB"]

        const query1 = sql.dropTable
            .replace('?', tableArr[0])
        const query2 = sql.dropTable
            .replace('?',tableArr[1])

        return setupDatabase._testExports.dropTables(tableArr, mysqlHelperMock)
            .then(() => {
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledWith(query1)
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledWith(query2)
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledTimes(tableArr.length)
            })
    })

})

describe('setup-database:createTables', () => {

    it('should call runQuery from mysqlHelper with the appropriate queries when recreate is set to true', () => {
        const phonyTable = "phonyA"
        const lookupTable = "phonyA_lookup"

        const query1 = sql.createPhonyTable
            .replace('?', phonyTable)
        const query2 = sql.createPhonyLookupTable
            .replace('?',lookupTable)

        return setupDatabase._testExports.createTables(phonyTable, lookupTable, true, mysqlHelperMock)
            .then(() => {
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledWith(query1)
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledWith(query2)
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledTimes(2)
            })
    })

    it('should call runQuery from mysqlHelper with the appropriate queries when recreate is set to false', () => {
        const phonyTable = "phonyA"
        const lookupTable = "phonyA_lookup"

        const query1 = sql.createPhonyTableIfNotExists
            .replace('?', phonyTable)
        const query2 = sql.createPhonyLookupTableIfNotExists
            .replace('?',lookupTable)

        return setupDatabase._testExports.createTables(phonyTable, lookupTable, false, mysqlHelperMock)
            .then(() => {
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledWith(query1)
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledWith(query2)
                expect(mysqlHelperMock.runQuery).toHaveBeenCalledTimes(2)
            })
    })

})

describe ('setup-database:getPhonyDataValues', () => {

    it('should return an array of arrays with the items in the specified path', () => {
        const phonyDir = path.resolve(__dirname, 'foo.csv')

        return setupDatabase._testExports.getPhonyDataValues(phonyDir)
            .then((results) => {
                expect(results).toEqual(expectedPhonyDataValues)
            })

    })

})

#!/usr/bin/env node
'use strict'

const fs = require('fs')
const MysqlHelper = require('../../../src/lib/mysql-helper/index')
const path = require('path')
const Q = require('q')

const sql = require('../../etc/phony_database_setup_sql_scripts.json')

const Pii = [
    'phony_address',
    'phony_email',
    'phony_first',
    'phony_last',
    'phony_mi',
    'phony_phone'
]

const getPhonyDataValues = (filePath) => {
    return Q.ninvoke(fs, 'readFile', filePath, 'utf8')
        .then((data) => {
            const dataArr = data.split(',')
            return dataArr.map((value) => {
                return [value]
            })
        })
}

const createTables = (phonyTable, lookupTable, recreate, mysqlHelper) => {
    const phonyTableQuery = recreate ?
        sql.createPhonyTable.replace('?', phonyTable) :
        sql.createPhonyTableIfNotExists.replace('?', phonyTable);

    console.log(`Creating table "${phonyTable}"`)
    return mysqlHelper.runQuery(phonyTableQuery)
        .then(() => {
            const lookupTableQuery = recreate ?
                sql.createPhonyLookupTable.replace('?', lookupTable) :
                sql.createPhonyLookupTableIfNotExists.replace('?', lookupTable)

            console.log(`Creating table "${lookupTable}"`)
            return mysqlHelper.runQuery(lookupTableQuery)
        })
}

const dropTables = (tableArr, mysqlHelper) => {
    return Q.all (
        tableArr.map((table) => {
            const dropTableQuery = sql.dropTable
                .replace('?',table)

            console.log(`Dropping table "${table}"`)
            return mysqlHelper.runQuery(dropTableQuery)
        })
    )
}

const setupTables = (pii, recreate, mysqlHelper) => {
    const phonyTable = pii
    const lookupTable = `${pii}_lookup`

    const useDbQuery = sql.useDatabase.replace('?', mysqlHelper.connectionDetails.database)

    return mysqlHelper.runQuery(useDbQuery)
        .then(() => {
            if (recreate) {
                return dropTables([phonyTable, lookupTable], mysqlHelper)
            }
        })
        .then(() => {
            return createTables(phonyTable, lookupTable, recreate, mysqlHelper)
        })
}

const cli = (opts, args) => {
    let mysqlHelper

    return MysqlHelper.create()
        .then((helper) => {
            mysqlHelper = helper
            return mysqlHelper.createConnection()
        })
        .then(() => {
            return Q.all(
                Pii.map((piiName) => {
                    return setupTables(piiName, opts.recreate, mysqlHelper)
                })
            )
        })
        .then(() => {
            mysqlHelper.releaseConnection()
            console.log("Done.")
        })
        .catch((error) => {
            mysqlHelper.releaseConnection()
            console.log(error)
            throw error
        })
}

module.exports = {
    cli,
    _testExports: {
        setupTables,
        dropTables,
        createTables,
        getPhonyDataValues
    }
}

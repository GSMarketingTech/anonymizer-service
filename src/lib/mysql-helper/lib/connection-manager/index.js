'use strict'

const mysql = require('mysql')
const Q = require('q')
Q.longStackSupport = true

const defaultMaxTransactionRetries = 10

const defaultConnectionDetails = {
    connectionLimit: 100
}

const passwordMask = {
    password: '********'
}

const connectionPools = {}
const getConnection = (connectionDetails) => {

    const poolKey = JSON.stringify(connectionDetails)
    const deferred = Q.defer()

    if (!connectionPools[poolKey]) {
        console.log('mysql:getConnection', 'Creating connection pool')
        console.log(
            'mysql:getConnection',
            JSON.stringify(Object.assign(
                {},
                connectionDetails,
                passwordMask
            ), null, 2)
        )
        try {
            connectionPools[poolKey] = mysql.createPool(connectionDetails)
        }
        catch (error) {
            return Q.Promise.reject(error)
        }
    }

    try {
        console.log('mysql:getConnection', 'Creating connection')
        connectionPools[poolKey].getConnection((error, connection) => {
            if (error) {
                return deferred.reject(error)
            }
            console.log('mysql:getConnection', 'Got connection')
            deferred.resolve(connection)
        })
    }
    catch (error) {
        deferred.reject(error)
    }

    return deferred.promise

}

class ConnectionManager {

    constructor(connectionDetails) {
        this.connectionDetails = connectionDetails
        this.connection = null
    }

    createConnection() {

        if (this.connection) {
            return Q.Promise.resolve(this.connection)
        }

        const connectionDetails = Object.assign(
            {},
            defaultConnectionDetails,
            this.connectionDetails
        )

        return getConnection(connectionDetails)
            .then((connection) => {
                this.connection = connection
                return Q.Promise.resolve(this.connection)
            })
            .catch((error) => {
                console.log('MysqlHelper.getConnection', error.stack)
                return Q.Promise.reject(error)
            })

    }

    releaseConnection() {
        if (!this.connection) {
            return
        }
        try {
            this.connection.release()
            console.log('MysqlHelper.releaseConnection')
        }
        catch (error) {
            console.log('MysqlHelper.releaseConnection', error.stack)
        }
    }

    getRowCount(table) {
        const sql = `SELECT count(*) FROM ${table}`

        return this.runQuery(sql)
            .then((result) => {
                return result[0]['count(*)']
            })
    }

    runQuery(sql, values) {
        return this.createConnection()
            .then(() => {
                return Q.ninvoke(this.connection, 'query', sql, values)
            })
            .then((queryCallbackArgs) => {
                return queryCallbackArgs[0]
            })
    }

    runTransactionQueries(queries) {
        console.log('mysql-helper:runTransactionQueries')
        return this.createConnection()
            .then(() => {
                return Q.ninvoke(this.connection, 'query', queries.sql.join('; '), queries.values)
            })
            .then((results) => {
                const responses = results[0]
                responses.forEach((item) => {
                    if (item.serverStatus === 43 &&
                        item.affectedRows === 0 &&
                        item.message.includes('&Records: 0  Duplicates: 0  Warnings: 0')) {
                        throw new Error('Insufficient phony values in the database.')
                    }
                })
            })
    }

    retryTransaction(queries, options) {
        const deferred = Q.defer()
        setTimeout(() => {
            options.retries--
            this.runTransaction(queries, options)
                .then((result) => {
                    deferred.resolve(result)
                })
                .catch((error) => {
                    deferred.reject(error)
                })
        }, options.retries * 100)
        return deferred.promise
    }

    runTransaction(queries, options) {
        console.log('mysql-helper:runTransaction')

        const opts = Object.assign({}, options)
        if (undefined === opts.retries) {
            opts.retries = defaultMaxTransactionRetries
        }
        else if (isNaN(opts.retries) || 0 > opts.retries) {
            const error = new Error('Invalid number of transaction retries specified')
            return Q.Promise.reject(error)
        }

        let connection

        if (0 < opts.retries) {
            return this.createConnection()
                .then((c) => {
                    connection = c
                    console.log('Beginning transaction')
                    return Q.ninvoke(connection, 'beginTransaction')
                })
                .then(() => {
                    return this.runTransactionQueries(queries)
                })
                .then(() => {
                    console.log('Committing transaction')
                    return Q.ninvoke(connection, 'commit')
                })
                .catch((error) => {
                    console.log(error.stack)

                    if (!connection) {
                        throw error
                    }

                    if (error.message === 'Insufficient phony values in the database.') {
                        throw error
                    }

                    console.log('Rolling back transaction')
                    return Q.ninvoke(connection, 'rollback')
                        .then(() => {
                            return this.retryTransaction(queries, opts)
                        })

                })
        }

        return Q.Promise.reject(new Error(`Exceeded transaction retry limit.`))
    }

}

module.exports = {
    create: (connectionDetails) => {
        return new ConnectionManager(connectionDetails)
    },
    _testExports: {
        getConnection,
        connectionPools
    }
}

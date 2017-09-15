'use strict'

const mysql = require('mysql')
const Q = require('q')
Q.longStackSupport = true

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
                return Q.Promise.resolve('Established database connection')
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
        return Q.ninvoke(this.connection, 'query', sql, values)
            .then((queryCallbackArgs) => {
                return queryCallbackArgs[0]
            })
    }

    rollback(waitTime) {
        const wait = (ms) => {
            ms = ms || 500
            const start = new Date().getTime()
            for (let i =0; i < 1e7; i++) {
                if ((new Date().getTime() - start) > ms) {
                    break;
                }
            }
        }

        wait(waitTime)

        console.log("Rolling back..")
        return Q.ninvoke(this.connection, 'rollback')
            .catch((error) => {
                console.log(error.message)
            })
    }

    commit() {
        return Q.ninvoke(this.connection, 'commit')
    }

    runTransactionQueries(queryArr, options) {
        const opts = Object.assign({}, options)
        opts.groupEvery = options.groupEvery || 1

        const skippedErrMsgs = []
        const newQueryArr = queryArr

        return queryArr.reduce((promise, query) => {
            return promise
                .then(() => {
                    return this.runQuery(query.sql, [query.values])
                })
                .then((response) => {
                    if (response.serverStatus === 35
                        && response.affectedRows === 0) {
                        throw new Error("Not enough phony values in the database.")
                    }
                })
                .catch((error) => {
                    if (error.code !== options.skipErrorCode) {
                        throw error
                    }
                    skippedErrMsgs.push(error.message)
                    const index = newQueryArr.findIndex((item) => {
                        return query === item
                    })
                    newQueryArr.splice(index, options.groupEvery)
                })
        }, Q.Promise.resolve())
            .then(() => {
                if (skippedErrMsgs.length) {
                    const error = new Error (skippedErrMsgs)
                    error.newQueryArr = newQueryArr
                    throw error
                }
            })
    }

    beginTransaction() {
        return Q.ninvoke(this.connection, 'beginTransaction')
    }

    recursiveTransaction(queryArr, iteration, options) {
        const opts = Object.assign({}, options)
        opts.maxRetries = opts.maxRetries || 10
        let committed = false

        if (iteration < opts.maxRetries) {
            return this.beginTransaction()
                .then(() => {
                    return this.runTransactionQueries(queryArr, opts)
                })
                .then(() => {
                    return this.commit()
                })
                .then(() => {
                    committed = true
                })
                .catch((error) => {
                    console.log(error.message)
                    if (error.newQueryArr) {
                        queryArr = error.newQueryArr
                    }
                    if (error.message === 'Not enough phony values in the database.') {
                        throw error
                    }
                    return this.rollback(opts.waitTime)
                })
                .then(() => {
                    if (!committed) {
                        return this.recursiveTransaction(queryArr, ++iteration, opts)
                    }
                })
        }
        throw new Error("Exceeded transaction max retry")
    }

    runTransaction(queryArr, options) {
        const transactionMax = 200

        const batches = []
        while (queryArr.length) {
            batches.push(queryArr.splice(0, transactionMax))
        }

        return batches.reduce((promise, batch) => {
            return promise.then(() => {
                return this.recursiveTransaction(batch, 0, options)
            })
        }, Q.Promise.resolve())
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

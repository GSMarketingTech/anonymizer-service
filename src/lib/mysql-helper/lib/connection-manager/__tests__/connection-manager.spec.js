'use strict'

jest.dontMock('..')
jest.mock('mysql')

const MysqlHelper = require('../index')

describe('connection-manager:runQuery', () => {

    const mysqlHelper = MysqlHelper.create()

    it('should call connection.query', () => {
        const sql = 'SELECT BLAH BLAH BLAH'
        const values = [ 'one', 'two', 'three' ]
        mysqlHelper.connection = {
            query: jest.fn((arg1, arg2, callback) => {
                const results = []
                expect(arg1).toBe(sql)
                expect(arg2).toBe(values)
                callback(null, results)
            })
        }
        return mysqlHelper.createConnection()
            .then(() => {
                return mysqlHelper.runQuery(sql, values)
            })
            .then(() => {
                return expect(mysqlHelper.connection.query).toHaveBeenCalled()
            })
            .catch((error) => {
                //should never get here
                expect(error).toBeFalsy()
            })
    })

    it('should blow up if query errors out', () => {
        const sql = 'SELECT BLAH BLAH BLAH'
        const values = [ 'one', 'two', 'three' ]
        const error = new Error('None shall pass!')
        let errorHappened = false
        mysqlHelper.connection = {
            query: jest.fn(() => {
                throw error
            })
        }
        return mysqlHelper.createConnection()
            .then(() => {
                return mysqlHelper.runQuery(sql, values)
            })
            .then(() => {
                return expect(mysqlHelper.connection.query).toHaveBeenCalled()
            })
            .catch((e) => {
                errorHappened = true
                return expect(e).toBe(error)
            })
            .then(() => {
                return expect(errorHappened).toBeTruthy()
            })
    })

    it('should blow up if query resulted in an error', () => {
        const sql = 'SELECT BLAH BLAH BLAH'
        const values = [ 'one', 'two', 'three' ]
        const error = new Error('None shall pass!')
        let errorHappened = false
        mysqlHelper.connection = {
            query: jest.fn((arg1, arg2, callback) => {
                const results = []
                expect(arg1).toBe(sql)
                expect(arg2).toBe(values)
                callback(error)
            })
        }
        return mysqlHelper.createConnection()
            .then(() => {
                return mysqlHelper.runQuery(sql, values)
            })
            .then(() => {
                return expect(mysqlHelper.connection.query).toHaveBeenCalled()
            })
            .catch((e) => {
                errorHappened = true
                return expect(e).toBe(error)
            })
            .then(() => {
                return expect(errorHappened).toBeTruthy()
            })
    })

})

describe('mysql-helper:retryTransaction', () => {

    const Q = require('q')
    let mysqlHelper
    const connectionDetails = {}

    beforeEach(() => {
        jest.useFakeTimers()
        mysqlHelper = MysqlHelper.create(connectionDetails)
    })

    it('should set a timeout that calls runTransaction', () => {
        const queries = []
        const options = { retries: 1 }
        mysqlHelper.runTransaction = jest.fn((queries, options) => {
            return Q.Promise.resolve({
                queries,
                options
            })
        })

        const promise = mysqlHelper.retryTransaction(queries, options)

        jest.runAllTimers()

        return promise.then((result) => {
            expect(mysqlHelper.runTransaction).toHaveBeenCalled()
            expect(result.options.retries).toBe(0)
        })
    })

    it('should create a rejected promise if runTransaction fails', () => {
        const msg = 'blah'
        const queries = []
        const options = { retries: 1 }
        mysqlHelper.runTransaction = jest.fn(() => {
            return Q.Promise.reject(new Error(msg))
        })
        const promise = mysqlHelper.retryTransaction(queries, options)

        jest.runAllTimers()

        return promise.then(() => {
            // should not get here
            expect(true).toBeFalsy()
        })
            .catch((error) => {
                expect(error.message).toBe(msg)
            })
    })

})

describe('mysql-helper:runTransaction', () => {

    const Q = require('q')
    let mysqlHelper
    const mockConnection = {}
    const connectionDetails = {}

    beforeEach(() => {
        mysqlHelper = MysqlHelper.create(connectionDetails)
        mysqlHelper.connection = mockConnection
        mysqlHelper.retryTransaction = jest.fn((queries, options) => {
            return Q.Promise.resolve({
                queries,
                options
            })
        })
        mysqlHelper.runTransactionQueries = jest.fn(() => {
            return Q.Promise.resolve()
        })
        mockConnection.beginTransaction = jest.fn((callback) => {
            callback()
        })
        mockConnection.commit = jest.fn((callback) => {
            callback()
        })
        mockConnection.rollback = jest.fn((callback) => {
            callback()
        })
    })

    it('should run as expected', () => {
        return mysqlHelper.runTransaction()
            .then(() => {
                expect(mockConnection.beginTransaction).toHaveBeenCalled()
                expect(mysqlHelper.runTransactionQueries).toHaveBeenCalled()
                expect(mockConnection.commit).toHaveBeenCalled()
            })
    })

    it('should fail if unable to acquire a connection', () => {
        const msg = 'blah'
        mysqlHelper.connection = null
        mysqlHelper.createConnection = jest.fn(() => {
            return Q.Promise.reject(new Error(msg))
        })
        return mysqlHelper.runTransaction()
            .then(() => {
                // should not get here
                expect(true).toBeFalsy()
            })
            .catch((error) => {
                expect(mockConnection.beginTransaction).not.toHaveBeenCalled()
                expect(error.message).toBe(msg)
            })
    })

    it('should retry if unable to begin a transaction', () => {
        const msg = 'blah'
        mockConnection.beginTransaction = jest.fn(() => {
            throw new Error(msg)
        })
        return mysqlHelper.runTransaction()
            .then(() => {
                expect(mockConnection.beginTransaction).toHaveBeenCalled()
                expect(mockConnection.rollback).toHaveBeenCalled()
                expect(mysqlHelper.retryTransaction).toHaveBeenCalled()
            })
    })

    it('should retry if unable to run queries', () => {
        const msg = 'blah'
        mysqlHelper.runTransactionQueries = jest.fn(() => {
            return Q.Promise.reject(new Error(msg))
        })
        return mysqlHelper.runTransaction()
            .then(() => {
                expect(mockConnection.beginTransaction).toHaveBeenCalled()
                expect(mysqlHelper.runTransactionQueries).toHaveBeenCalled()
                expect(mockConnection.rollback).toHaveBeenCalled()
                expect(mysqlHelper.retryTransaction).toHaveBeenCalled()
            })
    })

    it('should retry if unable to commit transaction', () => {
        const msg = 'blah'
        mockConnection.commit = jest.fn(() => {
            throw new Error(msg)
        })
        return mysqlHelper.runTransaction()
            .then(() => {
                expect(mockConnection.beginTransaction).toHaveBeenCalled()
                expect(mysqlHelper.runTransactionQueries).toHaveBeenCalled()
                expect(mockConnection.commit).toHaveBeenCalled()
                expect(mockConnection.rollback).toHaveBeenCalled()
                expect(mysqlHelper.retryTransaction).toHaveBeenCalled()
            })
    })

    it('should die if unable to rollback transaction', () => {
        const msg = 'blah'
        mockConnection.beginTransaction = jest.fn(() => {
            throw new Error('unable to begin transaction')
        })
        mockConnection.rollback = jest.fn(() => {
            throw new Error(msg)
        })
        return mysqlHelper.runTransaction()
            .then(() => {
                // should not get here
                expect(true).toBeFalsy()
            })
            .catch((error) => {
                expect(error.message).toBe(msg)
                expect(mockConnection.beginTransaction).toHaveBeenCalled()
                expect(mockConnection.rollback).toHaveBeenCalled()
                expect(mysqlHelper.retryTransaction).not.toHaveBeenCalled()
            })
    })

    it('should die if out of retries', () => {
        mockConnection.beginTransaction = jest.fn(() => {
            throw new Error('unable to begin transaction')
        })
        return mysqlHelper.runTransaction([], { retries: 0 })
            .then(() => {
                // should not get here
                expect(true).toBeFalsy()
            })
            .catch((error) => {
                expect(error.message).toBe('Exceeded transaction retry limit.')
            })
    })

    it('should not allow negative retries', () => {
        return mysqlHelper.runTransaction([], { retries: -1 })
            .then(() => {
                // should not get here
                expect(true).toBeFalsy()
            })
            .catch((error) => {
                expect(error.message).toBe('Invalid number of transaction retries specified')
            })
    })

    it('should retry 10 times by default', () => {
        mockConnection.beginTransaction = jest.fn(() => {
            throw new Error('unable to begin transaction')
        })
        mysqlHelper.retryTransaction = jest.fn((queries, options) => {
            expect(options.retries).toBe(10)
        })
        return mysqlHelper.runTransaction()
            .then(() => {
                // should not get here
                expect(true).toBeFalsy()
            })
            .catch(() => {
                expect(mysqlHelper.retryTransaction).toHaveBeenCalled()
            })
    })

})

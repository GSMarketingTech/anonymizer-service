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

describe('connection-manager:rollback', () => {

    const mysqlHelper = MysqlHelper.create()

    it('should call connection.rollback', () => {
        mysqlHelper.connection = {
            rollback: jest.fn((callback) => {
                return callback(null)
            })
        }

        return mysqlHelper.rollback()
            .then(() => {
                expect(mysqlHelper.connection.rollback).toHaveBeenCalled()
            })
    })

})

describe('connection-manager:commit', () => {

    const mysqlHelper = MysqlHelper.create()

    it('should call connection.commit', () => {
        mysqlHelper.connection = {
            commit: jest.fn((callback) => {
                return callback(null)
            })
        }

        return mysqlHelper.commit()
            .then(() => {
                expect(mysqlHelper.connection.commit).toHaveBeenCalled()
            })
    })

})

describe('connection-manager:beginTransaction', () => {

    const mysqlHelper = MysqlHelper.create()

    it('should call connection.beginTransaction', () => {
        mysqlHelper.connection = {
            beginTransaction: jest.fn((callback) => {
                return callback(null)
            })
        }

        return mysqlHelper.beginTransaction()
            .then(() => {
                expect(mysqlHelper.connection.beginTransaction).toHaveBeenCalled()
            })
    })

})

describe('connection-manager:runTransaction', () => {

    const mysqlHelper = MysqlHelper.create()

    it('should begin the transaction, run the queries, and commit if there are no errors', () => {
        mysqlHelper.connection = {
            beginTransaction: jest.fn((callback) => {
                return callback(null)
            }),
            commit: jest.fn((callback) => {
                return callback(null)
            }),
            rollback: jest.fn((callback) => {
                return callback(null)
            }),
            query: jest.fn((arg1, arg2, callback) => {
                return callback(null, [
                    {
                        serverStatus: 0
                    }
                ])
            })
        }

        const queryArr = [
            {
                sql:"Select ...",
                values: [ 'foo', 'bar' ]
            }
        ]

        return mysqlHelper.runTransaction(queryArr)
            .then(() => {
                expect(mysqlHelper.connection.beginTransaction).toHaveBeenCalled()
                expect(mysqlHelper.connection.commit).toHaveBeenCalled()
                expect(mysqlHelper.connection.query).toHaveBeenCalledTimes(1)
                expect(mysqlHelper.connection.rollback).toHaveBeenCalledTimes(0)
            })
    })

})

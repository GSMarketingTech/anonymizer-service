'use strict'

const EncryptedStore = require('../index')
const data = require('./data.json')
const encryptedStore = new EncryptedStore( data, data, {}, null )

jest.mock('aws-sdk')

const AWS = require('aws-sdk')

AWS.config = jest.fn(() => {
    return {
        update: jest.fn()
    }
})

AWS.KMS = jest.fn(() => {
    return {
        decrypt: jest.fn((params, callback) => {
            return callback(null, { Plaintext: "new_str" })
        }),
        encrypt: jest.fn((params, callback) => {
            return callback(null, { CiphertextBlob: "new_str" })
        })
    }
})

describe('encrypted-store:_skipDecryptingValue', () => {

    it('should return false if the type of the value passed in is string', () => {
        const myVal = "foo"
        const skipDecrypting = encryptedStore._skipDecryptingValue(myVal)
        expect(skipDecrypting).toBeFalsy()
    })

    it('should return true if the type of the value passed in is something other than a string', () => {
        const myVal = {
            foo: "bar"
        }
        const skipDecrypting = encryptedStore._skipDecryptingValue(myVal)
        expect(skipDecrypting).toBeTruthy()
    })

})

describe('encrypted-store:_decryptKey', () => {

    beforeEach(() => {
        encryptedStore._decrypted = {}
        encryptedStore._encrypted = data
        encryptedStore._done = false
    })

    it('should return the current key value of the encrypted data if the value is a string', () => {
        const key = "bar_notStr"

        return encryptedStore._decryptKey({}, key)
            .then((result) => {
                expect(result).toBe(data[key])
            })
    })

    it('should return the decrypted value if the key value is not a string', () => {
        const decryptedVal = "abc"
        const key = "foo_str"

        const kms = {
            decrypt: jest.fn((params, callback) => {
                return callback(null, { Plaintext: decryptedVal })
            })
        }

        return encryptedStore._decryptKey(kms, key)
            .then((result) => {
                expect(result).toBe(decryptedVal)
            })
    })

    it('should throw an error if an error occurs doing kms.decrypt', () => {
        const key = "foo_str"

        const kms = {
            decrypt: jest.fn((params, callback) => {
                return callback("Blow Up!")
            })
        }

        return encryptedStore._decryptKey(kms, key)
            .then((result) => {
                //should not get here
                expect(result).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

describe('encrypted-store:decrypt', () => {

    beforeEach(() => {
        encryptedStore._decrypted = {}
        encryptedStore._encrypted = data
        encryptedStore._done = false
    })

    it('should return the decrypted value', () => {
        const expectedResult = Object.assign({}, data)
        expectedResult.foo_str = "new_str"

        return encryptedStore.decrypt()
            .then((result) => {
                expect(result).toEqual(expectedResult)
            })
    })

    it('should return the existing decrypted values if the done property is set to true', () => {
        const decryptedVal = {
            foo: "bar"
        }
        encryptedStore._decrypted = decryptedVal
        encryptedStore._done = true

        return encryptedStore.decrypt()
            .then((result) => {
                expect(result).toEqual(decryptedVal)
            })
    })

})

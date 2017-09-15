'use strict'

const AWS = require('aws-sdk')
AWS.config.apiVersions = {
    kms: '2014-11-01'
}
AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
})

const Q = require('q')
Q.longStackSupport = true

class EncryptedStore {

    constructor(encrypted, timeoutSeconds) {
        this._timeoutThreshold = timeoutSeconds
        this._timeout = null
        this._done = false
        this._encrypted = encrypted || {}
        this._decrypted = {}
    }

    _skipDecryptingValue(value) {
        return 'string' !== typeof value
    }

    _decryptKey(kms, key) {
        const deferred = Q.defer()
        const value = this._encrypted[key]
        if (this._skipDecryptingValue(value)) {
            this._decrypted[key] = value
            deferred.resolve(value)
            return deferred.promise
        }
        try {
            const params = {
                CiphertextBlob: new Buffer(value, 'base64')
            }
            kms.decrypt(params, (error, data) => {
                if (error) {
                    return deferred.reject(new Error(error))
                }
                this._decrypted[key] = data.Plaintext.toString('ascii')
                return deferred.resolve(this._decrypted[key])
            })
        }
        catch (error) {
            deferred.reject(error)
        }
        return deferred.promise
    }

    _startTimeout(deferred) {
        const f = () => {
            if (!this._done) {
                deferred.reject(new Error('Timed out decrypting'))
            }
        }
        this._timeout = setTimeout(f, this._timeoutThreshold * 1000)
    }

    decrypt() {
        const deferred = Q.defer()
        if (this._timeoutThreshold) {
            this._startTimeout(deferred)
        }
        if (this._done) {
            deferred.resolve(Object.assign({}, this._decrypted))
            return deferred.promise
        }

        const kms = new AWS.KMS()
        const promises = Object.keys(this._encrypted).map((key) => {
            return this._decryptKey(kms, key)
        })
        Q.all(promises)
            .then((results) => {
                this._done = true
                deferred.resolve(Object.assign({}, this._decrypted))
            })
            .catch((error) => {
                this._done = true
                deferred.reject(error)
            })

        return deferred.promise
    }

}

module.exports = EncryptedStore

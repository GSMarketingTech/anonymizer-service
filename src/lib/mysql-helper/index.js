'use strict'

const ConnectionManager = require('./lib/connection-manager/index')
const EncryptedStore = require('../encrypted-store/index')
const path = require('path')
const Q = require('q')

const encryptedDataPath = '../../secure/db.json'
let connectionDetails = null

const getConnectionDetails = () => {
    if (connectionDetails) {
        return Q.Promise.resolve(connectionDetails)
    }

    const encryptedData = require(path.resolve(__dirname, encryptedDataPath))
    const encryptedStore = new EncryptedStore(encryptedData)

    return encryptedStore.decrypt()
        .then((decryptedData) => {
            connectionDetails = decryptedData
            return connectionDetails
        })
}

module.exports = {
    create: () => {
        return getConnectionDetails()
            .then((connectionDetails) => {
                return ConnectionManager.create(connectionDetails)
            })
    }
}

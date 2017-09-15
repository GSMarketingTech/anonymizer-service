#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const Q = require('q')
Q.longStackSupport = true

const AWS = require('aws-sdk')
AWS.config.apiVersions = {
    lambda: '2015-03-31'
}

const createFunction = (config, lambda) => {

    const deferred = Q.defer()

    try {
        lambda.createFunction(config, (error, data) => {
            if (error) {
                deferred.reject(new Error(error))
                return
            }
            console.log('Created function')
            console.log(data)
            deferred.resolve(data)
        })
    }
    catch (error) {
        deferred.reject(error)
    }

    return deferred.promise
}

const updateFunctionCode = (config, lambda) => {

    const deferred = Q.defer()

    const params = {}
    const takeKeys = [
        'FunctionName',
        'Publish'
    ]
    takeKeys.forEach((key) => {
        params[key] = config[key]
    })
    params.ZipFile = config.Code.ZipFile
    params.Publish = true

    try {
        lambda.updateFunctionCode(params, (error, data) => {
            if (error) {
                deferred.reject(new Error(error))
                return
            }
            console.log('Updated code')
            console.log(data)
            deferred.resolve(config)
        })
    }
    catch (error) {
        deferred.reject(error)
    }

    return deferred.promise

}

const updateFunctionConfiguration = (config, lambda) => {

    const deferred = Q.defer()

    const params = Object.assign({}, config)

    const removeKeys = [
        'Code',
        'Publish',
    ]
    removeKeys.forEach((key) => {
        delete params[key]
    })

    try {
        lambda.updateFunctionConfiguration(params, (error, data) => {
            if (error) {
                return deferred.reject(new Error(error))
            }
            console.log('Updated configuration')
            console.log(data)
            deferred.resolve(config)
        })
    }
    catch (error) {
        deferred.reject(error)
    }

    return deferred.promise

}

const updateFunction = (config, lambda) => {
    return updateFunctionConfiguration(config, lambda)
        .then((config) => {
            return updateFunctionCode(config, lambda)
        })
}

const functionExists = (interpretedConfig, lambda) => {

    const deferred = Q.defer()

    const baseParams = {
        MaxItems: 100
    }

    const functionName = interpretedConfig.FunctionName

    const listFunctions = (params) => {
        try {
            lambda.listFunctions(params, (error, data) => {

                if (error) {
                    deferred.reject(new Error(error))
                    return
                }

                const functionMatches = (f) => {
                    return f.FunctionName === functionName
                }

                if (data.Functions.find(functionMatches)) {
                    deferred.resolve(true)
                    return
                }

                if (data.NextMarker) {
                    params.Marker = data.NextMarker
                    listFunctions(params)
                    return
                }

                deferred.resolve(false)

            })
        }
        catch (error) {
            deferred.reject(error)
        }
    }

    listFunctions(baseParams)

    return deferred.promise

}

const loadZipFile = (config, filename) => {
    return Q.nfcall(fs.readFile, filename)
        .then((data) => {
            config.Code.ZipFile = data
            return config
        })
}

const getCustomConfig = (interpretedConfig, configPath) => {

    const deferred = Q.defer()

    try {
        fs.access(configPath, fs.R_OK, (error) => {
            if (error) {
                console.warn('Unable to load configuration customization')
                deferred.reject(error)
            }
            else {
                const customConfig = require(configPath)
                const config = Object.assign({}, interpretedConfig, customConfig)
                deferred.resolve(config)
            }
        })
    }
    catch (error) {
        deferred.reject(error)
    }

    return deferred.promise
}

const cli = (opts, args) => {
    const interpretedConfig = {
        FunctionName: args.function,
        Handler: [ args.function, 'handler' ].join('.')
    }

    let config, lambda
    const configName = `${args.function}.config.json`
    const configPath = path.resolve(__dirname, `../../../etc/${configName}`)
    const zipPath = path.resolve(__dirname, `../../../src/${args.function}.zip`)

    return getCustomConfig(interpretedConfig, configPath)
        .then((customConfig) => {
            config = customConfig
            AWS.config.update(config.aws)
            delete config.aws
            lambda = new AWS.Lambda()
        })
        .then(() => {
            return loadZipFile(config, zipPath)
        })
        .then((newConfig) => {
            config = newConfig
            return functionExists(interpretedConfig, lambda)
        })
        .then((exists) => {
            if (exists) {
                return updateFunction(config, lambda)
            }
            return createFunction(config, lambda)
        })
}

module.exports = {
    cli,
    _testExports: {
        functionExists,
        getCustomConfig,
        loadZipFile,
        createFunction,
        updateFunctionCode,
        updateFunctionConfiguration,
        updateFunction
    }
}

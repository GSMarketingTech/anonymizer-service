#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const Q = require('q')
Q.longStackSupport = true;

const AWS = require('aws-sdk')
AWS.config.apiVersions = {
    apigateway: '2015-07-09'
}

const cli = (opts, args) => {

    const interpretedConfig = {
        api: {
            id: undefined
        }
    }

    const configPath = path.resolve(__dirname, `../../../etc/${args.api}.api.config.json`)
    let apigateway, config

    return getCustomConfig(interpretedConfig, configPath)
        .then((apiConfig) => {
            config = apiConfig
            apigateway = new AWS.APIGateway()
            return apiExists(config, args.api, apigateway)
        })
        .then((apiExists) => {
            if (apiExists) {
                return updateApi(config, apigateway)
            }

            return createApi(config, apigateway)
        })
        .then((config) => {
            return deployApi(config, 0, apigateway)
        })

}

const apiExists = (interpretedConfig, apiName, apigateway) => {

    const deferred = Q.defer()

    const baseParams = {
        limit: 100
    }

    const scanApis = (params) => {
        apigateway.getRestApis(params, (error, data) => {

            if (error) {
                deferred.reject(new Error(error))
                return
            }

            const apiMatches = (a) => {
                return a.name === apiName
            }

            const api =  data.items.find(apiMatches)
            if (api) {
                interpretedConfig.api.id = api.id
                deferred.resolve(true)
                return
            }

            if (data.position) {
                params.position = data.position
                scanApis(params)
                return
            }

            return deferred.resolve(false)

        })
    }

    scanApis(baseParams)

    return deferred.promise

}

const getCustomConfig = (interpretedConfig, configPath) => {
    const deferred = Q.defer()

    try {
        fs.access(configPath, fs.R_OK, (error) => {
            if (error) {
                console.warn('Unable to load api configuration file')
                deferred.reject(error)
            }
            else {
                const customConfig = require(configPath)
                const config = Object.assign({}, interpretedConfig, customConfig)
                AWS.config.update(config.aws)

                deferred.resolve(config)
            }
        })
    }
    catch (error) {
        deferred.reject(error)
    }

    return deferred.promise
}

const importRestApi = (config, apigateway) => {
    const deferred = Q.defer()
    delete config.aws
    const params = {
        body: JSON.stringify(config)
    }
    try {
        apigateway.importRestApi(params, (error, data) => {
            if (error) {
                return deferred.reject(new Error(error))
            }
            console.log('Created API')
            console.log(data)
            config.api.id = data.id
            deferred.resolve(config)
        })
    }
    catch (error) {
        deferred.reject(error)
    }
    return deferred.promise
}

const createApi = (config, apigateway) => {
    return importRestApi(config, apigateway)
}

const putRestApi = (config, apigateway) => {
    const deferred = Q.defer()
    const params = {
        body: JSON.stringify(config),
        restApiId: config.api.id,
        mode: 'overwrite'
    }
    try {
        apigateway.putRestApi(params, (e, d) => {
            if (e) {
                return deferred.reject(new Error(e))
            }
            console.log('Updated API')
            console.log(d)
            deferred.resolve(config)
        })
    }
    catch (error) {
        deferred.reject(error)
    }
    return deferred.promise
}

const updateApi = (config, apigateway) => {
    return putRestApi(config, apigateway)
}

const deployApi = (config, tries, apigateway) => {

    const maxTries = 10
    tries = tries || 0
    const deferred = Q.defer()

    const params = Object.assign({}, config.createDeployment.dev)
    params.restApiId = config.api.id

    apigateway.createDeployment(params, (error, data) => {

        if (error) {
            // too many requests in a short time
            // back off and try again
            if (429 === error.statusCode && maxTries > tries ) {
                const nextTry = tries + 1
                console.log(`Deployed too quickly, trying again (${nextTry} of ${maxTries})`)
                return setTimeout(() => {
                    deployApi(config, nextTry)
                        .then((result) => {
                            deferred.resolve(result)
                        })
                        .catch((error) => {
                            deferred.reject(error)
                        })
                }, nextTry * nextTry * 1000)
            }
            return deferred.reject(new Error(error))
        }

        console.log('Deployed API')
        console.log(data)
        deferred.resolve(config)

    })

    return deferred.promise

}

module.exports = {
    cli,
    _testExports: {
        apiExists,
        getCustomConfig,
        importRestApi,
        createApi,
        putRestApi,
        updateApi,
        deployApi
    }
}

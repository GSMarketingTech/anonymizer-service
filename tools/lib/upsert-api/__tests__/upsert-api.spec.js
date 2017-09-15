'use strict'

const upsertApi = require('..')
const path = require('path')

jest.mock('aws-sdk')

describe('upsert-api:apiExists', () => {

    it('should return true if the one of the apis returned by aws matches the name of the api passed in', () => {
        const interpretedConfig = {
            api: {
                id: undefined
            }
        }

        const apiName = 'foo'

        const apigateway = {
            getRestApis: (params, callback) => {
                const data = {
                    items: [
                        {
                            name: "bar"
                        },
                        {
                            name: apiName
                        }
                    ]
                }

                return callback(null, data)
            }
        }

        return upsertApi._testExports.apiExists(interpretedConfig, apiName, apigateway)
            .then((exists) => {
                expect(exists).toBeTruthy()
            })
    })

    it('should return false if the none of the apis returned by aws match the name of the api passed in', () => {
        const interpretedConfig = {
            api: {
                id: undefined
            }
        }

        const apiName = 'foo'

        const apigateway = {
            getRestApis: (params, callback) => {
                const data = {
                    items: [
                        {
                            name: "bar"
                        },
                        {
                            name: "some other api"
                        }
                    ]
                }

                return callback(null, data)
            }
        }

        return upsertApi._testExports.apiExists(interpretedConfig, apiName, apigateway)
            .then((exists) => {
                expect(exists).toBeFalsy()
            })
    })

    it('should return a rejected promise if apigateway returns an error', () => {
        const interpretedConfig = {
            api: {
                id: undefined
            }
        }

        const apiName = 'foo'

        const apigateway = {
            getRestApis: (params, callback) => {
                return callback(new Error())
            }
        }

        return upsertApi._testExports.apiExists(interpretedConfig, apiName, apigateway)
            .then((result) => {
                //should never get here
                expect(result).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

describe('upsert-api:getCustomConfig', () => {

    it('should return a config that includes the json config and interpreted config properties', () => {
        const interpretedConfig = {
            api: {
                id: undefined
            }
        }
        const configPath = path.resolve(__dirname, 'foo.config.json')

        const customConfig = require(configPath)
        const expectedConfig = Object.assign({}, interpretedConfig, customConfig)

        return upsertApi._testExports.getCustomConfig(interpretedConfig, configPath)
            .then((config) => [
                expect(config).toEqual(expectedConfig)
            ])
    })

    it('should return a rejected promise if an error occurs while doing fs.access', () => {
        const interpretedConfig = {
            api: {
                id: undefined
            }
        }
        const configPath = 'wrong/path/to/config'

        return upsertApi._testExports.getCustomConfig(interpretedConfig, configPath)
            .then((result) => [
                //should not get here
                expect(result).toBeFalsy()
            ])
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

describe('upsert-api:importRestApi', () => {

    it('should return a resolved promise when the importRestApi method in apigateway does not return an error', () => {
        const expectedResult = {
            api: {
                id: '123'
            }
        }

        const apigateway = {
            importRestApi: (config, callback) => {
                return callback(null, expectedResult.api)
            }
        }

        return upsertApi._testExports.importRestApi({api: {id: undefined}}, apigateway)
            .then((result) => {
                expect(result).toEqual(expectedResult)
            })
    })

    it('should return a rejected promise when the importRestApi method in apigateway returns an error', () => {
        const apigateway = {
            importRestApi: (config, callback) => {
                return callback(new Error())
            }
        }

        return upsertApi._testExports.importRestApi({}, apigateway)
            .then((result) => {
                //should not get here
                expect(result).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

describe('upsert-api:putRestApi', () => {

    it('should return a resolved promise when the putRestApi method in apigateway does not return an error', () => {
        const expectedResult = {
            api: {
                id: 123
            }
        }

        const config = {
            api: {
                id: 123
            }
        }

        const apigateway = {
            putRestApi: (config, callback) => {
                return callback(null, expectedResult.api)
            }
        }

        return upsertApi._testExports.putRestApi(config, apigateway)
            .then((result) => {
                expect(result).toEqual(expectedResult)
            })
    })

    it('should return a rejected promise when the putRestApi method in apigateway returns an error', () => {
        const apigateway = {
            putRestApi: (config, callback) => {
                return callback(new Error())
            }
        }

        const config = {
            api: {
                id: 123
            }
        }

        return upsertApi._testExports.putRestApi(config, apigateway)
            .then((result) => {
                //should not get here
                expect(result).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

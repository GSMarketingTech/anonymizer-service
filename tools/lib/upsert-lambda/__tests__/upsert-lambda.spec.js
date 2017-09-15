'use strict'

const upsertLambda = require('..')
const path = require('path')

describe('upsertLambda:functionExists', () => {

    it('should return true if the one of the functions returned by lambda matches the name of the function passed in', () => {
        const interpretedConfig = {
            FunctionName: "foo",
            Handler: "foo.handler"
        }

        const lambda = {
            listFunctions: (params, callback) => {
                const data = {
                    Functions: [
                        {
                            FunctionName: "bar"
                        },
                        {
                            FunctionName: interpretedConfig.FunctionName
                        }
                    ]
                }

                return callback(null, data)
            }
        }

        return upsertLambda._testExports.functionExists(interpretedConfig, lambda)
            .then((exists) => {
                expect(exists).toBeTruthy()
            })

    })

    it('should return false if the none of the functions returned by lambda matches the name of the function passed in', () => {
        const interpretedConfig = {
            FunctionName: "foo",
            Handler: "foo.handler"
        }

        const lambda = {
            listFunctions: (params, callback) => {
                const data = {
                    Functions: [
                        {
                            FunctionName: "function_1"
                        },
                        {
                            FunctionName: "function_2"
                        }
                    ]
                }

                return callback(null, data)
            }
        }

        return upsertLambda._testExports.functionExists(interpretedConfig, lambda)
            .then((exists) => {
                expect(exists).toBeFalsy()
            })

    })

    it('should return a rejected promise if lambda returns an error', () => {
        const interpretedConfig = {
            FunctionName: "foo",
            Handler: "foo.handler"
        }

        const lambda = {
            listFunctions: (params, callback) => {
                return callback(new Error())
            }
        }

        return upsertLambda._testExports.functionExists(interpretedConfig, lambda)
            .then((result) => {
                //should never get here
                expect(result).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

describe('upsertLambda:getCustomConfig', () => {

    it('should return a config that includes the json config and interpreted config properties', () => {
        const interpretedConfig = {
            FunctionName: "foo",
            Handler: "foo.handler"
        }
        const configPath = path.resolve(__dirname, 'foo.config.json')

        const customConfig = require(configPath)
        const expectedConfig = Object.assign({}, interpretedConfig, customConfig)

        return upsertLambda._testExports.getCustomConfig(interpretedConfig, configPath)
            .then((config) => [
                expect(config).toEqual(expectedConfig)
            ])
    })

    it('should return a rejected promise if an error occurs while doing fs.access', () => {
        const interpretedConfig = {
            FunctionName: "foo",
            Handler: "foo.handler"
        }
        const configPath = 'wrong/path/to/config'

        return upsertLambda._testExports.getCustomConfig(interpretedConfig, configPath)
            .then((result) => [
                //should not get here
                expect(result).toBeFalsy()
            ])
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

describe('upsertLambda:loadZipFile', () => {

    it('should return the appropriate config', () => {
        const file = path.resolve(__dirname, 'foo.txt')
        const config = {
            Code: {
                ZipFile: ""
            }
        }

        const expectedResult = Object.assign({}, config)
        expectedResult.Code.ZipFile = "hello world"

        return upsertLambda._testExports.loadZipFile(config, file)
            .then((result) => {
                expect(result).toEqual(expectedResult)
            })

    })

})

describe('upsertLambda:createFunction', () => {

    it('should return a resolved promise when the createFunction method in lambda does not return an error', () => {
        const expectedResult = "success!"

        const lambda = {
            createFunction: (config, callback) => {
                return callback(null, expectedResult)
            }
        }

        return upsertLambda._testExports.createFunction({}, lambda)
            .then((result) => {
                expect(result).toBe(expectedResult)
            })
    })

    it('should return a rejected promise when the createFunction method in lambda returns an error', () => {
        const expectedResult = "success!"

        const lambda = {
            createFunction: (config, callback) => {
                return callback(new Error())
            }
        }

        return upsertLambda._testExports.createFunction({}, lambda)
            .then((result) => {
                //should not get here
                expect(result).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

describe('upsertLambda:updateFunctionCode', () => {

    it('should call updateFunctionCode from lambda with the appropriate parameters', () => {
        const zipFileData = "bar"
        const config = {
            FunctionName: "foo",
            Code: {
                ZipFile: zipFileData
            },
            Publish: false
        }

        const lambda = {
            updateFunctionCode: (params, callback) => {
                expect(params.ZipFile).toBe(zipFileData)
                expect(params.Publish).toBe(true)
                return callback(null, "success!")
            }
        }

        return upsertLambda._testExports.updateFunctionCode(config, lambda)
            .then((result) => {
                expect(result).toBe(config)
            })

    })

    it('should return a rejected promise if the updateFunctionCode method in lambda returns an error', () => {
        const config = {
            FunctionName: "foo",
            Code: {
                ZipFile: "bar"
            },
            Publish: false
        }

        const lambda = {
            updateFunctionCode: (params, callback) => {
                return callback(new Error())
            }
        }

        return upsertLambda._testExports.updateFunctionCode(config, lambda)
            .then((result) => {
                //should not get here
                expect(result).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
            })

    })

})

describe('upsertLambda:updateFunctionConfiguration', () => {

    it('should call the updateFunctionConfiguration method from lambda with the appropriate parameters', () => {
        const config = {
            FunctionName: "foo",
            Code: {
                ZipFile: "bar"
            },
            Publish: false
        }

        const expectedParams = Object.assign({}, config)
        delete expectedParams.Code
        delete expectedParams.Publish

        const lambda = {
            updateFunctionConfiguration: (params, callback) => {
                expect(params).toEqual(expectedParams)
                return callback(null, config)
            }
        }

        return upsertLambda._testExports.updateFunctionConfiguration(config, lambda)
            .then((results) => {
                expect(results).toBe(config)
            })
    })

    it('should return a rejected promise if the updateFunctionCode method in lambda returns an error', () => {
        const config = {
            FunctionName: "foo",
            Code: {
                ZipFile: "bar"
            },
            Publish: false
        }

        const lambda = {
            updateFunctionConfiguration: (params, callback) => {
                return callback(new Error())
            }
        }

        return upsertLambda._testExports.updateFunctionConfiguration(config, lambda)
            .then((results) => {
                //should not get here
                expect(results).toBeFalsy()
            })
            .catch((error) => {
                expect(error).toBeTruthy()
            })
    })

})

describe('upsertLambda:updateFunction', () => {

    it('should call updateFunctionConfiguration and updateFunctionCode from lambda', () => {
        const config = {
            FunctionName: "foo",
            Code: {
                ZipFile: "bar"
            },
            Publish: false
        }

        const lambda = {
            updateFunctionConfiguration: jest.fn((params, callback) => {
                return callback(null, config)
            }),
            updateFunctionCode: jest.fn((params, callback) => {
                return callback(null, "success!")
            })
        }

        return upsertLambda._testExports.updateFunction(config, lambda)
            .then((result) => {
                expect(result).toEqual(config)
                expect(lambda.updateFunctionConfiguration).toHaveBeenCalled()
                expect(lambda.updateFunctionCode).toHaveBeenCalled()
            })

    })

})

'use strict'

const anonymizerService = require('./lib/anonymizer-service')
const httpResponses = require('./etc/http-status-responses.json')
const Q = require('q')

const createResponseError = (error) => {
    const body = {
        error: {}
    }
    const defaultErr = httpResponses.INTERNAL_ERROR

    body.error.source = error.source || defaultErr.source
    body.error.description = error.description || defaultErr.description

    if (error.code) {
        body.error.code = error.code
    }

    if (error.message) {
        body.error.message = error.message
    }

    if (error.stack) {
        body.error.stack = error.stack
    }

    return JSON.stringify(body)
}

const createResponse = (body, statusCode, error, headers) => {
    const response = {}
    response.body = JSON.stringify(body)
    response.statusCode = statusCode|| 200
    response.headers = headers || {
            // Lambda Proxy Integration requires that this
            // be set in the proxy response
            'Access-Control-Allow-Origin': '*'
    }

    if (error) {
        response.body = createResponseError(error)
    }

    return response
}

const getEventBody = (event) => {
    let body = event.body

    if (typeof body === "string") {
        body = JSON.parse(body)
    }

    if (typeof body !== "object" || (Object.keys(body).length === 0)) {
        return Q.Promise.reject(httpResponses.BAD_REQUEST)
    }

    return Q.Promise.resolve(body)
}

const getStringSizeImMb = (str) => {
    return (Buffer.byteLength(str, 'utf8')) / 1000000
}

const verifyEvent = (event) => {
    if (getStringSizeImMb(JSON.stringify(event)) >= 10) {
        const error = httpResponses.REQUEST_ENTITY_TOO_LARGE
        error.message = "Request size should not exceed 10 MB"

        throw error
    }
}

const processEvent = (event) => {
    verifyEvent(event)

    return getEventBody(event)
        .then((body) => {
            return anonymizerService.run(body.columns, body.rows)
        })
        .then((data) => {
            const body = {
                columns: data.shift(),
                rows: data
            }
            return createResponse(body)
        })
        .catch((error) => {
            const statusCode = error.status || 500
            throw createResponse(null, statusCode, error)
        })
}

exports.handler = function (event, context, callback) {

    const result = []

    processEvent(event)
        .then((response) => {
            console.log('Anonymizing service completed successfully.')
            return response
        })
        .catch((error) => {
            console.log('Anonymizing service ended in error.')
            return error
        })
        .then((response) => {
            result[1] = response
            context.callbackWaitsForEmptyEventLoop = false;
            callback.apply(null, result)
        })

}

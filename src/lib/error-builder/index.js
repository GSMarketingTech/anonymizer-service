'use strict'

const create = (status, source, description, message, code, stack) => {
    const error = {}

    if (status) {
        error.status = status
    }

    if (source) {
        error.source = source
    }

    if (description) {
        error.description = description
    }

    if (message) {
        error.message = message
    }

    if (code) {
        error.code = code
    }

    if (stack) {
        error.stack = stack
    }

    return error
}

module.exports = {
    create
}

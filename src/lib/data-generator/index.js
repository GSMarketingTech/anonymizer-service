'use strict'

const crypto = require('crypto')

const text = require('./etc/text.json')

const toHash = (str) => {
    if (str && (typeof str === 'string')) {
        const upperStr = str.toUpperCase()
        return crypto
            .createHash('md5')
            .update(upperStr)
            .digest('hex')
    }

    return str
}

const toHashKeepLength = (str) => {
    const hash = toHash(str)
    if (hash && typeof hash === 'string') {
        return hash.substring(0, str.length)
    }

    return str
}

const toLatLong = (str) => {
    if (str && (typeof str === 'string')) {
        return str
    }

    return str
}

const getLoremIpsum = (textLength) => {
    let newStr = ""

    while (newStr.length < textLength) {
        newStr += text.loremIpsum
    }

    return newStr.substring(0, textLength)
}

const toLoremIpsum = (str) => {
    if (str && (typeof str === 'string')) {
        return getLoremIpsum(str.length)
    }

    return str
}

const toLoremIpsumXml = (xmlStr) => {
    if (xmlStr && (typeof xmlStr === 'string')) {
        // "<bar>abcde</bar><foo>01234567</foo>" => "<bar>Lorem</bar><foo>Lorem Ip</foo>"
        const xmlReg = /[^>]+(?![^<]*>)/g

        return xmlStr.replace(xmlReg, (match) => {
            return getLoremIpsum(match.length)
        })
    }

    return xmlStr
}

const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

const getRandomString = (length) => {
    const chars = [
        text.lowercaseLetters,
        text.uppercaseLetters,
        text.numerals,
        text.symbols
    ].join('')
    let randomStr = ""
    
    for (let i = 0; i < length; i++) {
        randomStr += chars.charAt(getRandomInt(0, chars.length - 1))
    }

    return randomStr
}

const getRandomPassword = (minLength, maxLength) => {
    if (minLength >= 0
        && maxLength > 0
        && minLength <= maxLength) {
        return getRandomString(getRandomInt(minLength, maxLength))
    }

    throw new Error("Password lengths are invalid.")
}

module.exports = {
    toHash,
    toHashKeepLength,
    toLatLong,
    toLoremIpsum,
    toLoremIpsumXml,
    getRandomPassword
}

'use strict'

const crypto = require('crypto')
const dataConverter = require('../index')

describe('data-converter:toHash', () => {

    it('should return the hash for a string', () => {
        const myStr = "foo"
        const expectedHash = crypto
            .createHash('md5')
            .update(myStr.toUpperCase())
            .digest('hex')
        const result = dataConverter.toHash(myStr)
        expect(result).toBe(expectedHash)
    })

    it('should return the original value if the input string is an empty string', () => {
        const myStr = ""
        const result = dataConverter.toHash(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string null', () => {
        const myStr = null
        const result = dataConverter.toHash(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string is an integer (not a string)', () => {
        const myStr = 123
        const result = dataConverter.toHash(myStr)
        expect(result).toBe(myStr)
    })

})

describe('data-converter:toHashKeepLength', () => {

    it('should return a substring of the hash with the same length as the orignial string', () => {
        const myStr = "foo"
        const expectedHash = crypto
            .createHash('md5')
            .update(myStr.toUpperCase())
            .digest('hex')
        const result = dataConverter.toHashKeepLength(myStr)
        expect(result).toBe(expectedHash.substring(0, myStr.length))
        expect(result.length === myStr.length)
    })

    it('should return the original value if the input string is an empty string', () => {
        const myStr = ""
        const result = dataConverter.toHashKeepLength(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string null', () => {
        const myStr = null
        const result = dataConverter.toHashKeepLength(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string is an integer (not a string)', () => {
        const myStr = 123
        const result = dataConverter.toHashKeepLength(myStr)
        expect(result).toBe(myStr)
    })

})

describe('data-converter:toLatLong', () => {

    it('should return the unchanged value', () => {
        const myStr = "foo"
        const result = dataConverter.toLatLong(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string is an empty string', () => {
        const myStr = ""
        const result = dataConverter.toLatLong(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string null', () => {
        const myStr = null
        const result = dataConverter.toLatLong(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string is an integer (not a string)', () => {
        const myStr = 123
        const result = dataConverter.toLatLong(myStr)
        expect(result).toBe(myStr)
    })

})

describe('data-converter:toLoremIpsum', () => {

    it('should return a lorem ipsum string of the same length as the string passed in', () => {
        const myStr = "abcdef"
        const result = dataConverter.toLoremIpsum(myStr)
        expect(result.length).toBe(myStr.length)
        expect(result === myStr).toBeFalsy()
    })

    it('should return the original value if the input string is an empty string', () => {
        const myStr = ""
        const result = dataConverter.toLoremIpsum(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string null', () => {
        const myStr = null
        const result = dataConverter.toLoremIpsum(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string is an integer (not a string)', () => {
        const myStr = 123
        const result = dataConverter.toLoremIpsum(myStr)
        expect(result).toBe(myStr)
    })

})

describe('data-converter:toXMLLoremIpsum', () => {

    it('should return a generated xml that does not match the original xml', () => {
        const myXml = "<foo>bar</foo>"
        const result = dataConverter.toLoremIpsumXml(myXml)
        expect(result === myXml).toBeFalsy()
    })

    it('should return a generated xml that has the same xml tags as the original xml', () => {
        const myXml = "<foo>bar</foo>"
        const result = dataConverter.toLoremIpsumXml(myXml)
        expect(result.includes('<foo>')).toBeTruthy()
        expect(result.includes('</foo>')).toBeTruthy()
    })

    it('should return an xml with the same length as the original xml', () => {
        const myXml = "<foo>bar</foo>"
        const result = dataConverter.toLoremIpsumXml(myXml)
        expect(result.length === myXml.length).toBeTruthy()
    })

    it('should return the original value if the input string is an empty string', () => {
        const myStr = ""
        const result = dataConverter.toLoremIpsumXml(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string null', () => {
        const myStr = null
        const result = dataConverter.toLoremIpsumXml(myStr)
        expect(result).toBe(myStr)
    })

    it('should return the original value if the input string is an integer (not a string)', () => {
        const myStr = 123
        const result = dataConverter.toLoremIpsumXml(myStr)
        expect(result).toBe(myStr)
    })

})

describe('data-converter:toRandomPassword', () => {

    it('should return a generated password with an appropriate length', () => {
        const minPassLength = 8
        const maxPassLength = 20

        const result = dataConverter.getRandomPassword(minPassLength, maxPassLength)

        expect(result).toBeTruthy()
        expect(result.length >= minPassLength).toBeTruthy()
        expect(result.length <= maxPassLength).toBeTruthy()
    })

    it('should return an error if the password min length is not >= 0', () => {
        const minPassLength = -1
        const maxPassLength = 2

        expect(() => {
            dataConverter.getRandomPassword(minPassLength, maxPassLength)
        }).toThrow()
    })

    it('should return an error if the password max length is not > 0', () => {
        const minPassLength = 0
        const maxPassLength = -1

        expect(() => {
            dataConverter.getRandomPassword(minPassLength, maxPassLength)
        }).toThrow()
    })

    it('should return an error if the password max length less than the password min length', () => {
        const minPassLength = 3
        const maxPassLength = 2

        expect(() => {
            dataConverter.getRandomPassword(minPassLength, maxPassLength)
        }).toThrow()
    })

})

'use strict'

const fs = require('fs')
const path = require('path')
const Q = require('q')
const EasyZip = require('easy-zip2').EasyZip

const getFile = (path) => {
    return path.replace(/\\/g,'/').replace(/.*\//, '')
}

const createZip = (zipItems, zipPath) => {
    const zip = new EasyZip()

    const promises = zipItems.map((item) => {
        console.log("Adding to zip: " +  item)
        return Q.ninvoke(fs, 'stat', item)
            .then((stats) => {
                if (stats.isDirectory()) {
                    return Q.ninvoke(zip, 'zipFolder', item)
                }
                const fileName = getFile(item)
                return Q.ninvoke(zip, 'addFile', fileName, item)
            })
    })

    return Q.all(promises)
        .then(() => {
            return Q.ninvoke(zip, 'writeToFile', zipPath)
        })
}

const deleteItem = (path) => {
    return Q.ninvoke(fs, 'unlink', path)
        .catch((error) => {
            if (error.code !== 'ENOENT') {
                throw error
            }
        })
}

const cli = (opts, args) => {

    return deleteItem(args.zipPath)
        .then(() => {
            return createZip(args.itemsToZip, args.zipPath)
        })
        .then(() => {
            console.log("Done")
        })

}

module.exports = {
    cli,
    _testExports: {
        getFile,
        createZip,
        deleteItem
    }
}
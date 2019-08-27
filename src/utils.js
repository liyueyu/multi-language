const fs = require('fs');

/**
 * 获取文件内容
 * @param filePath
 * @param encoding
 * @returns {Promise<String>}
 */
const readFile = (filePath, encoding = 'utf8') => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, encoding, (err, data) => {
            if (err) {
                reject(err)
            };
            resolve(data);
        });
    })
}

/**
 * 获取json文件内容
 * @param filePath
 * @returns {Promise<Object>}
 */
const getJson = (filePath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await readFile(filePath)
            const json = JSON.parse(result)
            resolve(json)
        } catch (e) {
            reject(e)
        }
    })
}

/**
 * 转换为包含5位数字的字符串
 * @param num
 * @returns {string}
 */
const num2key = (num = 0) => {
    return ('0000' + num).slice(-5)
}

module.exports = {
    readFile,
    getJson,
    num2key
}

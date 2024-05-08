/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

/** 
 * Deep merges two objects, overwriting properties of the base object with the update object.
 * @param {Object} baseObject The base object.
 * @param {Object} updateObject The object to merge.
 * @returns {Object} The merged object.
*/
const deepMerge = (baseObject, updateObject) => {
    let merged = Object.assign({}, baseObject);

    for (let key in updateObject) {
        if (updateObject[key] instanceof Object && !(updateObject[key] instanceof Array)) {
            merged[key] = deepMerge(baseObject[key], updateObject[key]);
        } else {
            merged[key] = updateObject[key];
        }
    }

    return merged;
}

module.exports = {
    deepMerge
}
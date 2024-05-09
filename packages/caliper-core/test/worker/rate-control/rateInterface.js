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

const RateInterface = require('../../../lib/worker/rate-control/rateInterface');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');
const deepMerge = require('../../helpers').deepMerge;

const chai = require('chai');
chai.should();
const sinon = require('sinon');

const createRateInterface = (stubOverrides, returnMessageAndStats = false) => {
    const defaultStubs = {
        testMessageStubs: {
            getRateControlSpec: {
                type: "fixed-rate",
                opts: {}
            },
        },
        statsStubs: {},
        workerIndex: 0
    }

    const stubs = deepMerge(defaultStubs, stubOverrides);

    const testMessage = sinon.createStubInstance(TestMessage, stubs.testMessageStubs);
    const stats = sinon.createStubInstance(TransactionStatisticsCollector, stubs.statsStubs);
    const rateInterface = new RateInterface(testMessage, stats, stubs.workerIndex);

    if (returnMessageAndStats) {
        return [rateInterface, testMessage, stats]
    }

    return rateInterface
}

describe('RateInterface', () => {
    describe("constructor", () => {
        it("should set the class properties", () => {
            const [rateInterface, testMessage, stats] = createRateInterface({
                testMessageStubs: {
                    getRateControlSpec: {
                        opts: {
                            test: 'test-control-options'
                        }
                    },
                    getRoundIndex: 1,
                    getRoundLabel: 'test-round-1',
                    getWorkersNumber: 2
                },
                statsStubs: {},
                workerIndex: 3
            }, true);

            rateInterface.testMessage.should.equal(testMessage);
            rateInterface.stats.should.equal(stats);
            rateInterface.workerIndex.should.equal(3);
            rateInterface.controller.should.deep.equal({
                type: "fixed-rate",
                opts: {
                    test: 'test-control-options'
                }
            });
            rateInterface.options.should.deep.equal({
                test: 'test-control-options'
            });
            rateInterface.roundIndex.should.equal(1);
            rateInterface.roundLabel.should.equal('test-round-1');
            rateInterface.numberOfWorkers.should.equal(2);
        })
    })

    describe("applyRateControl", () => {
        it("should throw an error", async () => {
            const rateInterface = createRateInterface()

            chai.expect(rateInterface.applyRateControl()).to.be.rejectedWith('Method \'applyRateControl\' is not implemented for this rate controller')
        })
    })

    describe("end", () => {
        it("should throw an error", () => {
            const rateInterface = createRateInterface()

            chai.expect(rateInterface.end()).to.be.rejectedWith('Method \'end\' is not implemented for this rate controller')
        })
    })
})


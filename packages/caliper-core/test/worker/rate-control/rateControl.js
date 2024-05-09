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

const rewire = require('rewire');

const RateControl = rewire('../../../lib/worker/rate-control/rateControl');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');
const deepMerge = require('../../helpers').deepMerge;

const chai = require('chai');
chai.should();
const sinon = require('sinon');

const createRateControl = (stubOverrides, returnMessageAndStats = false) => {
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
    const rateControl = new RateControl(testMessage, stats, stubs.workerIndex);

    if (returnMessageAndStats) {
        return [rateControl, testMessage, stats]
    }

    return rateControl
}

describe('RateControl', () => {
    describe("constructor", () => {
        it("should set the class properties correctly", () => {
            const [rateControl, testMessage, stats] = createRateControl({
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

            rateControl.testMessage.should.equal(testMessage);
            rateControl.stats.should.equal(stats);
            rateControl.workerIndex.should.equal(3);
            rateControl.options.should.deep.equal({
                test: 'test-control-options'
            });
            rateControl.roundIndex.should.equal(1);
            rateControl.roundLabel.should.equal('test-round-1');
            rateControl.numberOfWorkers.should.equal(2);
        })


        const rateControlTypes = [ "composite-rate", "fixed-load", "fixed-feedback-rate", "fixed-rate", "linear-rate", "maximum-rate", "zero-rate", "record-rate", "replay-rate" ];

        rateControlTypes.forEach((type) => it(`should create the correct rate controller for ${type}`, () => {
            // Stub the CapilerUtils module
            // loadModuleFunction is stubbed to return type passed to it instead of the actual factory function
            RateControl.__with__("CaliperUtils", {
                getLogger: sinon.stub(),
                loadModuleFunction: sinon.stub().returns(() => type)
            })(() => {
                const rateControl = createRateControl({
                    testMessageStubs: {
                        getRateControlSpec: {
                            type,
                            opts: {
                                test: 'test-control-options'
                            }
                        }
                    }
                });

                rateControl.controller.should.equal(type);
            })
        }));

        it("should throw an error if the rate controller type does not export the mandatory factory function", () => {
            // Stub the CapilerUtils module
            // loadModuleFunction is stubbed to return undefined
            RateControl.__with__("CaliperUtils", {
                getLogger: sinon.stub(),
                loadModuleFunction: sinon.stub().returns(undefined)
            })(() => {
                chai.expect(() => createRateControl()).to.throw('fixed-rate does not export the mandatory factory function');
            })
        })
    })

    describe("applyRateControl", () => {
        it("should delegate the rate control action to the controller", async () => {
            const rateControl = createRateControl();
            rateControl.controller.applyRateControl = sinon.stub().resolves();

            await rateControl.applyRateControl();

            rateControl.controller.applyRateControl.should.have.been.calledOnce;
        })
    })

    describe("end", () => {
        it("should delegate the end of the round to the controller", async () => {
            const rateControl = createRateControl();
            rateControl.controller.end = sinon.stub().resolves();

            await rateControl.end();

            rateControl.controller.end.should.have.been.calledOnce;
        })
    })

})

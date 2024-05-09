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

const ReplayRate = rewire('../../../lib/worker/rate-control/replayRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');
const util = require('../../../lib/common/utils/caliper-utils');
const deepMerge = require('../../helpers').deepMerge;

const chai = require('chai');
chai.should();
const sinon = require('sinon');

/*
* Create a rate controller with the provided options and stubs
*/
const createRateController = (rateControlSpecOptions, opts = {}) => {
    const options = {
        readBuffer: opts.readBuffer ?? false,
        fileExists: opts.fileExists ?? true,
        textFileContent: opts.textFileContent ?? "test-content",
        bufferFileContent: opts.bufferFileContent ?? Buffer.alloc(10),
    };

    const testMessageStubs = {
        getRateControlSpec: {
            type: "replay-rate",
            opts: deepMerge({
                pathTemplate: 'test-path-template',
                inputFormat: ReplayRate.TEXT_FORMAT,
            }, rateControlSpecOptions)
        },
        getRoundIndex: 0,
    }

    const testMessage = sinon.createStubInstance(TestMessage, testMessageStubs);
    const stats = sinon.createStubInstance(TransactionStatisticsCollector);

    ReplayRate.__set__('fs', {
        readFileSync: sinon.stub().returns(options.readBuffer ? options.bufferFileContent : options.textFileContent),
        existsSync: sinon.stub().returns(options.fileExists)
    })

    const rateController = new ReplayRate.createRateController(testMessage, stats, 0);

    return rateController
}

// Stub the logger
ReplayRate.__set__('logger', {
    warn: sinon.stub(),
    debug: sinon.stub()
});

describe('ReplayRate', () => {
    beforeEach(() => {
        ReplayRate.__get__('logger').warn.resetHistory();
        ReplayRate.__get__('logger').debug.resetHistory();
    })

    describe("constructor", () => {
        it("should error if pathTemplate is undefined", () => {
            const wrapper = () => createRateController({
                pathTemplate: undefined
            });
            wrapper.should.throw('The path to load the recording from is undefined');
        })

        it("should set the defaultSleepTime to 100 if not provided", () => {
            const rateController = createRateController();
            rateController.defaultSleepTime.should.equal(100);
        })

        it("should set the defaultSleepTime to the provided value", () => {
            const rateController = createRateController({
                defaultSleepTime: 200
            });
            rateController.defaultSleepTime.should.equal(200);
        })

        it("should default to TEXT_FORMAT if inputFormat is undefined", () => {
            const rateController = createRateController({
                inputFormat: undefined
            });

            rateController.inputFormat.should.equal('TEXT');
            ReplayRate.__get__('logger').warn.calledOnce.should.be.true;
            ReplayRate.__get__('logger').warn.calledWith('Input format is undefined. Defaulting to "TEXT" format').should.be.true;
        })

        it("should default to TEXT_FORMAT if inputFormat is not supported", () => {
            const rateController = createRateController({
                inputFormat: 'unsupported-format'
            });

            rateController.inputFormat.should.equal('TEXT');
            ReplayRate.__get__('logger').warn.calledOnce.should.be.true;
            ReplayRate.__get__('logger').warn.calledWith('Input format "unsupported-format" is not supported. Defaulting to "TEXT" format').should.be.true;
        })

        ReplayRate.supportedFormats.forEach((format) => {
            it(`should set inputFormat to ${format} if provided`, () => {
                const rateController = createRateController(
                    { inputFormat: format },
                    { readBuffer: format !== ReplayRate.TEXT_FORMAT });

                rateController.inputFormat.should.equal(format);
                ReplayRate.__get__('logger').warn.called.should.be.false;
                ReplayRate.__get__('logger').debug.calledOnce.should.be.true;
            })
        })

        it("should error if the trace file does not exist", () => {
            const wrapper = () => createRateController(
                { pathTemplate: 'non-existent-file' },
                { fileExists: false }
            );

            wrapper.should.throw('Trace file does not exist');
        })

        it("should import the data from a text file correctly", () => {
            const rateController = createRateController(
                { inputFormat: ReplayRate.TEXT_FORMAT },
                { textFileContent: '1\n2\n3\n4\n5' }
            );

            rateController.records.should.deep.equal([1, 2, 3, 4, 5]);
        })

        it("should import the data from a little endian binary file correctly", () => {
            const buffer = Buffer.alloc(24);
            buffer.writeUInt32LE(5, 0);
            for (let i = 1; i <= 5; i++) {
                buffer.writeUInt32LE(i, i * 4);
            }

            const rateController = createRateController(
                { inputFormat: ReplayRate.BINARY_LE_FORMAT },
                { bufferFileContent: buffer, readBuffer: true }
            );

            rateController.records.should.deep.equal([1, 2, 3, 4, 5]);
        })

        it("should import the data from a big endian binary file correctly", () => {
            const buffer = Buffer.alloc(24);
            buffer.writeUInt32BE(5, 0);
            for (let i = 1; i <= 5; i++) {
                buffer.writeUInt32BE(i, i * 4);
            }

            const rateController = createRateController(
                { inputFormat: ReplayRate.BINARY_BE_FORMAT },
                { bufferFileContent: buffer, readBuffer: true }
            );

            rateController.records.should.deep.equal([1, 2, 3, 4, 5]);
        })
    })

    describe("applyRateControl", () => {
        beforeEach(() => {
            util.sleep = sinon.stub();
        })

        describe("all records have been submitted", () => {
            it("should sleep for defaultSleepTime", async () => {
                const rateController = createRateController();

                rateController.stats.getTotalSubmittedTx.returns(5);
                rateController.records = [1, 2, 3, 4, 5];

                await rateController.applyRateControl();
                util.sleep.calledOnce.should.be.true;
                util.sleep.calledWith(rateController.defaultSleepTime).should.be.true;
            })

            it("should log a warning for the first time", async () => {
                const rateController = createRateController();

                rateController.stats.getTotalSubmittedTx.returns(5);
                rateController.records = [1, 2, 3, 4, 5];

                await rateController.applyRateControl();
                ReplayRate.__get__('logger').warn.calledOnce.should.be.true;
            })

            it("should not log a warning for subsequent calls", async () => {
                const rateController = createRateController();

                rateController.stats.getTotalSubmittedTx.returns(5);
                rateController.records = [1, 2, 3, 4, 5];

                await rateController.applyRateControl();
                await rateController.applyRateControl();
                ReplayRate.__get__('logger').warn.calledOnce.should.be.true;
            })
        })

        describe("not all records have been submitted", () => {
            it("should sleep for the remaining time", async () => {
                const rateController = createRateController();

                rateController.stats.getTotalSubmittedTx.returns(0);
                rateController.stats.getRoundStartTime.returns(Date.now() - 100);
                rateController.records = [200];

                await rateController.applyRateControl();
                util.sleep.calledOnce.should.be.true;
                util.sleep.calledWith(100).should.be.true;
            })

            it("should not sleep if the remaining time is less than 5ms", async () => {
                const rateController = createRateController();

                rateController.stats.getTotalSubmittedTx.returns(2);
                rateController.records = [1, 2, 3, 4, 5];

                await rateController.applyRateControl();
                util.sleep.called.should.be.false;
            })
        })
    })
})

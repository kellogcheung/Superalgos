exports.newSuperalgosBotModulesTradingPosition = function (processIndex) {
    /*
    This module packages all functions related to Positions.
    */
    const MODULE_NAME = 'Trading Position'
    let thisObject = {
        mantain: mantain,
        reset: reset,
        cycleBasedStatistics: cycleBasedStatistics,
        openPosition: openPosition,
        closingPosition: closingPosition,
        closePosition: closePosition,
        applyStopLossFormula: applyStopLossFormula,
        applyTakeProfitFormula: applyTakeProfitFormula,
        updateStopLoss: updateStopLoss,
        updateTakeProfit: updateTakeProfit,
        initialTargets: initialTargets,
        updateEnds: updateEnds,
        resetTradingEngineDataStructure: resetTradingEngineDataStructure,
        updateCounters: updateCounters,
        initialize: initialize,
        finalize: finalize
    }

    let tradingEngine
    let tradingSystem
    let sessionParameters

    return thisObject

    function initialize() {
        tradingSystem = TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SIMULATION_STATE.tradingSystem
        tradingEngine = TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SIMULATION_STATE.tradingEngine
        sessionParameters = TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_NODE.tradingParameters
    }

    function finalize() {
        tradingEngine = undefined
        tradingSystem = undefined
        sessionParameters = undefined
    }

    function mantain() {
        updateCounters()
        updateEnds()
    }

    function reset() {
        resetTradingEngineDataStructure()
    }

    function openPosition(situationName) {

        /* Starting begin and end */
        tradingEngine.current.position.begin.value = tradingEngine.current.episode.cycle.lastBegin.value
        tradingEngine.current.position.end.value = tradingEngine.current.episode.cycle.lastEnd.value

        /* Recording the opening at the Trading Engine Data Structure */
        tradingEngine.current.position.status.value = 'Open'
        tradingEngine.current.position.serialNumber.value = tradingEngine.current.episode.episodeCounters.positions.value + 1
        tradingEngine.current.position.identifier.value = TS.projects.superalgos.utilities.miscellaneousFunctions.genereteUniqueId()
        tradingEngine.current.position.beginRate.value = tradingEngine.current.episode.candle.close.value
        tradingEngine.current.position.positionBaseAsset.beginBalance.value = tradingEngine.current.episode.episodeBaseAsset.balance.value
        tradingEngine.current.position.positionQuotedAsset.beginBalance.value = tradingEngine.current.episode.episodeQuotedAsset.balance.value
        tradingEngine.current.position.situationName.value = situationName

        /* Initializing Stop and Take Phase */
        tradingEngine.current.position.stopLoss.stopLossPhase.value = 1
        tradingEngine.current.position.takeProfit.takeProfitPhase.value = 1

        /* Updating Episode Counters */
        tradingEngine.current.episode.episodeCounters.positions.value++

        /* Inicializing this counter */
        tradingEngine.current.episode.distanceToEvent.takePosition.value = 1

        /* Remember the balance we had before taking the position to later calculate profit or loss */
        tradingEngine.current.position.positionBaseAsset.beginBalance = tradingEngine.current.episode.episodeBaseAsset.balance.value
        tradingEngine.current.position.positionQuotedAsset.beginBalance = tradingEngine.current.episode.episodeQuotedAsset.balance.value
    }

    function closingPosition(exitType) {
        tradingEngine.current.position.status.value = 'Closing'
        tradingEngine.current.position.exitType.value = exitType

        /*
        By the time we figured out that the stop loss or take profit were hit, or 
        for whatever reason the position needs to be closed, the take profit and
        stop loss values for the next candle have already been calculated. In order
        to avoid being plotted, we will put them in zero. 
        */
        tradingEngine.current.position.stopLoss.value = 0
        tradingEngine.current.position.takeProfit.value = 0
    }

    function closePosition() {
        tradingEngine.current.position.status.value = 'Closed'
        tradingEngine.current.position.end.value = tradingEngine.current.episode.cycle.lastEnd.value
        tradingEngine.current.position.endRate.value = tradingEngine.current.episode.candle.close.value
        tradingEngine.current.position.positionBaseAsset.endBalance.value = tradingEngine.current.episode.episodeBaseAsset.balance.value
        tradingEngine.current.position.positionQuotedAsset.endBalance.value = tradingEngine.current.episode.episodeQuotedAsset.balance.value

        /*
        Now that the position is closed, it is the right time to move this position from current to last at the Trading Engine data structure.
        */
        TS.projects.superalgos.globals.processModuleObjects.MODULE_OBJECTS_BY_PROCESS_INDEX_MAP.get(processIndex).TRADING_ENGINE_MODULE_OBJECT.cloneValues(tradingEngine.current.position, tradingEngine.last.position)

        cycleBasedStatistics()

        /* Updating Hits & Fails */
        if (tradingEngine.current.position.positionBaseAsset.profitLoss.value > 0) {
            tradingEngine.current.episode.episodeBaseAsset.hits.value++
        }
        if (tradingEngine.current.position.positionBaseAsset.profitLoss.value < 0) {
            tradingEngine.current.episode.episodeBaseAsset.fails.value++
        }
        if (tradingEngine.current.position.positionQuotedAsset.profitLoss.value > 0) {
            tradingEngine.current.episode.episodeQuotedAsset.hits.value++
        }
        if (tradingEngine.current.position.positionQuotedAsset.profitLoss.value < 0) {
            tradingEngine.current.episode.episodeQuotedAsset.fails.value++
        }
    }

    function applyStopLossFormula(formulas, formulaId) {
        updateStopLossTakeProfitFinalValue(tradingEngine.current.position.stopLoss)
        tradingEngine.current.position.stopLoss.value = formulas.get(formulaId)
        updateStopLossTakeProfitInitialValue(tradingEngine.current.position.stopLoss)
        updateStopLossTakeProfitBeginEnd(tradingEngine.current.position.stopLoss)
    }

    function applyTakeProfitFormula(formulas, formulaId) {
        updateStopLossTakeProfitFinalValue(tradingEngine.current.position.takeProfit)
        tradingEngine.current.position.takeProfit.value = formulas.get(formulaId)
        updateStopLossTakeProfitInitialValue(tradingEngine.current.position.takeProfit)
        updateStopLossTakeProfitBeginEnd(tradingEngine.current.position.takeProfit)
    }

    function updateStopLossTakeProfitInitialValue(node) {
        /*
        We store the first Stop Loss or Take Profit value in a separate node.
        To know if it is the first one we compare its current value to the initial value.
        */
        if (node.initialValue.value === node.initialValue.config.initialValue) {
            node.initialValue.value = node.value
        }
    }

    function updateStopLossTakeProfitFinalValue(node) {
        /*
        We set the final value just before calcualting the new value, since the new calculated
        value is going to be discarded if the position is closed after it is calculated, but
        during the same candle.
        */
        node.finalValue.value = node.value
    }

    function updateStopLossTakeProfitBeginEnd(node) {
        /*
        Both the Stop Loss and the Take Profit have their own Begin and End.
        Ther reason for this is because they represent targets to be checked 
        at the next candle, so it does not apply that they share the begin and
        end of the position itself. 
        */
        node.begin.value =
            tradingEngine.current.episode.candle.begin.value +
            sessionParameters.timeFrame.config.value
        node.end.value =
            tradingEngine.current.episode.candle.end.value +
            sessionParameters.timeFrame.config.value
    }

    function updateStopLoss(phase) {
        tradingEngine.current.position.stopLoss.stopLossPhase.value = phase
    }

    function updateTakeProfit(phase) {
        tradingEngine.current.position.takeProfit.takeProfitPhase.value = phase
    }

    function initialTargets(tradingSystemStageNode, tradingEngineStageNode) {

        if (tradingSystemStageNode.initialTargets === undefined) {
            const message = 'Initial Targets Node Missing'

            let docs = {
                project: 'Superalgos',
                category: 'Topic',
                type: 'TS LF Trading Bot Error - ' + message,
                placeholder: {}
            }

            badDefinitionUnhandledException(undefined, message, tradingSystemStageNode, docs)
        }

        setTargetRate()
        setTargetSize()

        function setTargetRate() {
            if (tradingSystemStageNode.initialTargets.targetRate === undefined) {
                const message = 'Target Rate Node Missing'

                let docs = {
                    project: 'Superalgos',
                    category: 'Topic',
                    type: 'TS LF Trading Bot Error - ' + message,
                    placeholder: {}
                }

                badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets, docs)
            }
            if (tradingSystemStageNode.initialTargets.targetRate.formula === undefined) {
                const message = 'Formula Node Missing'

                let docs = {
                    project: 'Superalgos',
                    category: 'Topic',
                    type: 'TS LF Trading Bot Error - ' + message,
                    placeholder: {}
                }

                badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets.targetRate, docs)
            }

            let value = tradingSystem.formulas.get(tradingSystemStageNode.initialTargets.targetRate.formula.id)
            if (value === undefined) {
                const message = 'Target Rate Node Value Undefined'

                let docs = {
                    project: 'Superalgos',
                    category: 'Topic',
                    type: 'TS LF Trading Bot Error - ' + message,
                    placeholder: {}
                }

                badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets.targetRate, docs)
            }
            if (isNaN(value)) {
                const message = 'Target Rate Node Value Not A Number'

                let docs = {
                    project: 'Superalgos',
                    category: 'Topic',
                    type: 'TS LF Trading Bot Error - ' + message,
                    placeholder: {}
                }

                TS.projects.superalgos.utilities.docsFunctions.buildPlaceholder(docs, undefined, undefined, undefined, undefined, value, undefined)

                badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets.targetRate, docs)
            }

            switch (tradingSystemStageNode.type) {
                case 'Open Stage': {
                    tradingEngine.current.position.entryTargetRate.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value, 10)
                    break
                }
                case 'Close Stage': {
                    tradingEngine.current.position.exitTargetRate.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value, 10)
                    break
                }
            }
        }

        function setTargetSize() {
            /* Basic Validation */
            if (
                tradingSystemStageNode.initialTargets.targetSizeInBaseAsset !== undefined &&
                tradingSystemStageNode.initialTargets.targetSizeInQuotedAsset !== undefined
            ) {
                // 'Only Target Size In Base Asset or Target Size In Quoted Asset is allowed.'
                const message = 'Only One Target Size Allowed'

                let docs = {
                    project: 'Superalgos',
                    category: 'Topic',
                    type: 'TS LF Trading Bot Error - ' + message,
                    placeholder: {}
                }

                badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets, docs)
            }

            /* Position In Base Asset */
            if (tradingSystemStageNode.initialTargets.targetSizeInBaseAsset !== undefined) {
                if (tradingSystemStageNode.initialTargets.targetSizeInBaseAsset.formula !== undefined) {
                    let value = tradingSystem.formulas.get(tradingSystemStageNode.initialTargets.targetSizeInBaseAsset.formula.id)
                    if (value === undefined) {
                        const message = 'Target Size Value Undefined'

                        let docs = {
                            project: 'Superalgos',
                            category: 'Topic',
                            type: 'TS LF Trading Bot Error - ' + message,
                            placeholder: {}
                        }

                        badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets.targetSizeInBaseAsset, docs)
                    }
                    if (value === 0) {
                        const message = 'Target Size Value Zero'

                        let docs = {
                            project: 'Superalgos',
                            category: 'Topic',
                            type: 'TS LF Trading Bot Error - ' + message,
                            placeholder: {}
                        }

                        badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets.targetSizeInBaseAsset, docs)
                    }

                    switch (tradingSystemStageNode.type) {
                        case 'Open Stage': {
                            tradingEngine.current.position.positionBaseAsset.entryTargetSize.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value, 10)
                            tradingEngine.current.position.positionQuotedAsset.entryTargetSize.value =
                                TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value * tradingEngine.current.position.entryTargetRate.value, 10)
                            break
                        }
                        case 'Close Stage': {
                            tradingEngine.current.position.positionBaseAsset.exitTargetSize.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value, 10)
                            tradingEngine.current.position.positionQuotedAsset.exitTargetSize.value =
                                TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value * tradingEngine.current.position.exitTargetRate.value, 10)
                            break
                        }
                    }

                    /* Remember how the end user defined this stage. */
                    tradingEngineStageNode.stageDefinedIn.value = 'Base Asset'
                } else {
                    const message = 'Formula Node Missing'

                    let docs = {
                        project: 'Superalgos',
                        category: 'Topic',
                        type: 'TS LF Trading Bot Error - ' + message,
                        placeholder: {}
                    }

                    badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets.targetSizeInBaseAsset, docs)
                }
            }

            /* Position In Quoted Asset */
            if (tradingSystemStageNode.initialTargets.targetSizeInQuotedAsset !== undefined) {
                if (tradingSystemStageNode.initialTargets.targetSizeInQuotedAsset.formula !== undefined) {
                    let value = tradingSystem.formulas.get(tradingSystemStageNode.initialTargets.targetSizeInQuotedAsset.formula.id)
                    if (value === undefined) {
                        const message = 'Target Size Value Undefined'

                        let docs = {
                            project: 'Superalgos',
                            category: 'Topic',
                            type: 'TS LF Trading Bot Error - ' + message,
                            placeholder: {}
                        }

                        badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets.targetSizeInQuotedAsset, docs)
                    }
                    if (value === 0) {
                        const message = 'Target Size Value Zero'

                        let docs = {
                            project: 'Superalgos',
                            category: 'Topic',
                            type: 'TS LF Trading Bot Error - ' + message,
                            placeholder: {}
                        }

                        badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets.targetSizeInQuotedAsset, docs)
                    }
                    switch (tradingSystemStageNode.type) {
                        case 'Open Stage': {
                            tradingEngine.current.position.positionQuotedAsset.entryTargetSize.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value, 10)
                            tradingEngine.current.position.positionBaseAsset.entryTargetSize.value =
                                TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value / tradingEngine.current.position.entryTargetRate.value, 10)
                            break
                        }
                        case 'Close Stage': {
                            tradingEngine.current.position.positionQuotedAsset.exitTargetSize.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value, 10)
                            tradingEngine.current.position.positionBaseAsset.exitTargetSize.value =
                                TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(value / tradingEngine.current.position.exitTargetRate.value, 10)
                            break
                        }
                    }

                    /* Remember how the end user defined this stage. */
                    tradingEngineStageNode.stageDefinedIn.value = 'Quoted Asset'
                } else {
                    const message = 'Formula Node Missing'

                    let docs = {
                        project: 'Superalgos',
                        category: 'Topic',
                        type: 'TS LF Trading Bot Error - ' + message,
                        placeholder: {}
                    }

                    badDefinitionUnhandledException(undefined, message, tradingSystemStageNode.initialTargets.targetSizeInQuotedAsset, docs)
                }
            }
        }
    }

    function updateEnds() {
        if (tradingEngine.current.position.status.value === 'Open') {
            tradingEngine.current.position.end.value = tradingEngine.current.position.end.value + sessionParameters.timeFrame.config.value
            tradingEngine.current.position.endRate.value = tradingEngine.current.episode.candle.close.value
            tradingEngine.current.position.positionBaseAsset.endBalance.value = tradingEngine.current.episode.episodeBaseAsset.balance.value
            tradingEngine.current.position.positionQuotedAsset.endBalance.value = tradingEngine.current.episode.episodeQuotedAsset.balance.value
        }
    }

    function resetTradingEngineDataStructure() {
        if (tradingEngine.current.position.status.value === 'Closed') {
            TS.projects.superalgos.globals.processModuleObjects.MODULE_OBJECTS_BY_PROCESS_INDEX_MAP.get(processIndex).TRADING_ENGINE_MODULE_OBJECT.initializeNode(tradingEngine.current.position)
        }
    }

    function updateCounters() {
        if (tradingEngine.current.position.status.value === 'Open') {
            tradingEngine.current.position.positionCounters.periods.value++
        }
    }

    function cycleBasedStatistics() {

        calculateAssetsStatistics()
        calculatePositionStatistics()

        function calculateAssetsStatistics() {
            /* Profit Loss Calculation */
            tradingEngine.current.position.positionBaseAsset.profitLoss.value =
                tradingEngine.current.episode.episodeBaseAsset.balance.value -
                tradingEngine.current.position.positionBaseAsset.beginBalance

            tradingEngine.current.position.positionQuotedAsset.profitLoss.value =
                tradingEngine.current.episode.episodeQuotedAsset.balance.value -
                tradingEngine.current.position.positionQuotedAsset.beginBalance

            tradingEngine.current.position.positionBaseAsset.profitLoss.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(tradingEngine.current.position.positionBaseAsset.profitLoss.value, 10)
            tradingEngine.current.position.positionQuotedAsset.profitLoss.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(tradingEngine.current.position.positionQuotedAsset.profitLoss.value, 10)

            /* ROI Calculation */
            tradingEngine.current.position.positionBaseAsset.ROI.value =
                tradingEngine.current.position.positionBaseAsset.profitLoss.value * 100 /
                tradingEngine.current.strategyOpenStage.stageBaseAsset.targetSize.value

            tradingEngine.current.position.positionQuotedAsset.ROI.value =
                tradingEngine.current.position.positionQuotedAsset.profitLoss.value * 100 /
                tradingEngine.current.strategyOpenStage.stageQuotedAsset.targetSize.value

            tradingEngine.current.position.positionBaseAsset.ROI.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(tradingEngine.current.position.positionBaseAsset.ROI.value, 10)
            tradingEngine.current.position.positionQuotedAsset.ROI.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(tradingEngine.current.position.positionQuotedAsset.ROI.value, 10)

            /* Hit Fail Calculation */
            if (tradingEngine.current.position.positionBaseAsset.ROI.value > 0) {
                tradingEngine.current.position.positionBaseAsset.hitFail.value = 'Hit'
            }
            if (tradingEngine.current.position.positionBaseAsset.ROI.value < 0) {
                tradingEngine.current.position.positionBaseAsset.hitFail.value = 'Fail'
            }
            if (tradingEngine.current.position.positionBaseAsset.ROI.value === 0) {
                tradingEngine.current.position.positionBaseAsset.hitFail.value = 'Even'
            }
            if (tradingEngine.current.position.positionQuotedAsset.ROI.value > 0) {
                tradingEngine.current.position.positionQuotedAsset.hitFail.value = 'Hit'
            }
            if (tradingEngine.current.position.positionQuotedAsset.ROI.value < 0) {
                tradingEngine.current.position.positionQuotedAsset.hitFail.value = 'Fail'
            }
            if (tradingEngine.current.position.positionQuotedAsset.ROI.value === 0) {
                tradingEngine.current.position.positionQuotedAsset.hitFail.value = 'Even'
            }
        }

        function calculatePositionStatistics() {
            /* Profit Loss Calculation */
            tradingEngine.current.position.positionStatistics.profitLoss.value =
                (
                    tradingEngine.current.episode.episodeBaseAsset.profitLoss.value * tradingEngine.current.position.endRate.value +
                    tradingEngine.current.episode.episodeQuotedAsset.profitLoss.value
                )

            tradingEngine.current.position.positionStatistics.profitLoss.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(tradingEngine.current.position.positionStatistics.profitLoss.value, 10)

            /* ROI Calculation */
            tradingEngine.current.position.positionStatistics.ROI.value =
                (
                    tradingEngine.current.position.positionStatistics.profitLoss.value
                )
                * 100 /
                (
                    tradingEngine.current.position.positionBaseAsset.beginBalance * tradingEngine.current.position.beginRate.value +
                    tradingEngine.current.position.positionQuotedAsset.beginBalance
                )
            tradingEngine.current.position.positionStatistics.ROI.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(tradingEngine.current.position.positionStatistics.ROI.value, 10)

            /* Hit Fail Calculation */
            if (tradingEngine.current.position.positionStatistics.ROI.value > 0) {
                tradingEngine.current.position.positionStatistics.hitFail.value = 'Hit'
            }
            if (tradingEngine.current.position.positionStatistics.ROI.value < 0) {
                tradingEngine.current.position.positionStatistics.hitFail.value = 'Fail'
            }
            if (tradingEngine.current.position.positionStatistics.ROI.value === 0) {
                tradingEngine.current.position.positionStatistics.hitFail.value = 'Even'
            }

            /* Days Calculation */
            tradingEngine.current.position.positionStatistics.days.value =
                tradingEngine.current.position.positionCounters.periods.value *
                sessionParameters.timeFrame.config.value / TS.projects.superalgos.globals.timeConstants.ONE_DAY_IN_MILISECONDS

            tradingEngine.current.position.positionStatistics.days.value = TS.projects.superalgos.utilities.miscellaneousFunctions.truncateToThisPrecision(tradingEngine.current.position.positionStatistics.days.value, 10)
        }
    }

    function badDefinitionUnhandledException(err, message, node, docs) {
        tradingSystem.errors.push([node.id, message, docs])

        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME, "[ERROR] -> " + message);
        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME, "[ERROR] -> node.name = " + node.name);
        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME, "[ERROR] -> node.type = " + node.type);
        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME, "[ERROR] -> node.config = " + JSON.stringify(node.config));
        if (err !== undefined) {
            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME, "[ERROR] -> err.stack = " + err.stack);
        }
        throw 'Please fix the problem and try again.'
    }
}
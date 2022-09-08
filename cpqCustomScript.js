//https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_plugins.meta/cpq_dev_plugins/cpq_dev_jsqcp_methods.htm
export function onInit(quoteLines, conn) {
    const config = new Config();
    if (config.doInit) {
        setDisableProration();
        //resetCfAndSp(quoteLines, conn);
    }
	return Promise.resolve();
};
export function onBeforePriceRules(quote, quoteLines, conn) {
    const config = new Config();
    if (config.doBeforePriceRules) {
    }
	return Promise.resolve();
};
export function onBeforeCalculate(quote, quoteLines, conn) {
    const config = new Config();
    if (config.doBeforeCalculate) {
    }
	return Promise.resolve();
};
export function onAfterCalculate(quote, quoteLines, conn) {
    const config = new Config();
    if (config.doAfterCalculate) {
        calculateCfAndSp(quote, quoteLines, conn);
        //calculateSp(quote, quoteLines, conn);
    }
	return Promise.resolve();
};
export function onAfterPriceRules(quote, quoteLines, conn) {
    const config = new Config();
    if (config.doAfterPriceRules) {
        //calculateCf(quote, quoteLines, conn);
    }
	return Promise.resolve();
}

function resetCfAndSp(quoteLines, conn) {
    const config = new Config();
    if (quoteLines && quoteLines.length > 0) {
        quoteLines.forEach(function (quoteLine) {
            const qlGroupId = quoteLine.record['SBQQ__Group__c'];
            const qlIsSp = quoteLine.record['Is_Support_Package__c'];
            const qlNetTotal = quoteLine.record['SBQQ__NetTotal__c'];
            const qlProductCode = quoteLine.record['SBQQ__ProductCode__c'];
            //TOTAL UP ALL NON-CONVENIENCE FEE LINES
            if (qlProductCode == config.cfProductCode || qlIsSp) {
                quoteLine.record['SBQQ__ListPrice__c'] = 0;
                quoteLine.record['SBQQ__NetPrice__c'] = 0;
            }
        });
    }
}

class Config {
    constructor() {
        this.doInit = true;
        this.doBeforePriceRules = false;
        this.doBeforeCalculate = false;
        this.doAfterCalculate = true;
        this.doAfterPriceRules = false;
		this.cfRateTransform = {
			Custom: 0.0100,
			Monthly: 0.0100,
			Quarterly: 0.0075,
			Semiannual: 0.0050
		};
		this.cfProductCode = 'ADDONS-CVFE';
		this.spRateTransform = {
			'SUPPRT-SILVER': 0.10,
			'SUPPRT-GOLD': 0.15,
			'SUPPRT-PLATINUM': 0.2
		};
	}
}


function setDisableProration(quoteLines, conn) {
    if (quoteLines && quoteLines.length > 0) {
        quoteLines.forEach(function (quoteLine) {
            const qlDisableProration = quoteLine.record['Disable_Proration__c'];
            if (qlDisableProration) {
                quoteLine.calculateFullTermPrice = true;
            }

        });
    }
    return Promise.resolve();
}

function calculateSp(quote, quoteLines, conn) {
    var cfTotals;
	if (quote && quoteLines && quoteLines.length > 0) {
		cfTotals = getCfTotals(quoteLines, quote);
		console.log('cfTotals: ' + JSON.stringify(cfTotals));
		if (cfTotals) {
            setSp(quoteLines, quote, cfTotals);
		}
	}
}

function calculateCf(quote, quoteLines, conn) {
    var cfTotals;
	if (quote && quoteLines && quoteLines.length > 0) {
		cfTotals = getCfTotals(quoteLines, quote);
		console.log('cfTotals: ' + JSON.stringify(cfTotals));
		if (cfTotals) {
            setCf(quoteLines, quote, cfTotals);
		}
	}
}

function calculateCfAndSp(quote, quoteLines, conn) {
    	var cfTotals;
	if (quote && quoteLines && quoteLines.length > 0) {
		cfTotals = getCfTotals(quoteLines, quote);
		console.log('cfTotals: ' + JSON.stringify(cfTotals));
		if (cfTotals) {
            setSp(quoteLines, quote, cfTotals);
            setCf(quoteLines, quote, cfTotals);
		}
	}
}


function getCfTotals(quoteLines, quote) {
	var cfTotals = {
		rate: null,
		hasGroups: false,
		quoteTotal: null,
        groupsTotals: {},
        spTotal: 0
	}
	const config = new Config();
	const qBillingFrequency = quote.record['SBQQ__BillingFrequency__c'];
	//GET RATE
	if (config.cfRateTransform[qBillingFrequency]) {
		cfTotals.rate = config.cfRateTransform[qBillingFrequency];
	}
	//GET TOTALS
	quoteLines.forEach(function(quoteLine) {
        const qlGroupId = quoteLine.record['SBQQ__Group__c'];
        const qlIsSp = quoteLine.record['Is_Support_Package__c'];
		const qlNetTotal = quoteLine.record['SBQQ__NetTotal__c'];
		const qlProductCode = quoteLine.record['SBQQ__ProductCode__c'];
		//TOTAL UP ALL NON-CONVENIENCE FEE LINES
        if (qlProductCode != config.cfProductCode) {
			//GROUPS
			if (qlGroupId) {
				cfTotals.hasGroups = true;
				//SET EACH GROUP TOTAL
				if (!cfTotals.groupsTotals[qlGroupId]) {
					cfTotals.groupsTotals[qlGroupId] = qlNetTotal;
				} else {
					cfTotals.groupsTotals[qlGroupId] = (cfTotals.groupsTotals[qlGroupId] + qlNetTotal);
				}
			}
			//NO GROUPS
			else {
				//SET QUOTE TOTAL
				if (!cfTotals.quoteTotal) {
					cfTotals.quoteTotal = qlNetTotal;
				} else {
					cfTotals.quoteTotal = (cfTotals.quoteTotal + qlNetTotal);
				}
			}
		}
	});
	return cfTotals;
}

function setCf(quoteLines, quote, cfTotals) {
	const config = new Config();
	quoteLines.forEach(function(quoteLine) {
		var cf = 0;
		var groupTotal = 0;
		var quoteTotal = 0;
		var rate = cfTotals.rate;
		const qlGroupId = quoteLine.record['SBQQ__Group__c'];
		const qlProductCode = quoteLine.record['SBQQ__ProductCode__c'];
		//IS CF
		if (qlProductCode == config.cfProductCode) {
			if (rate) {
				//GROUPS
				if (cfTotals.hasGroups) {
					//MATCHES TO GROUP
					if (cfTotals.groupsTotals[qlGroupId]) {
						groupTotal = cfTotals.groupsTotals[qlGroupId];
						cf = (groupTotal * rate).toFixed(2);
					}
				}
				//NO GROUPS
				else {
                    quoteTotal = cfTotals.quoteTotal;
                    cf = (quoteTotal * rate).toFixed(2);
				}
			}
			//LOG
			console.log('groupTotal: ' + groupTotal);
			console.log('quoteTotal: ' + quoteTotal);
			console.log('rate: ' + rate);
			console.log('cf: ' + cf);
			//SET TOTALS
			quote.record['Total_for_Convenience_Fee__c'] = quoteTotal;
			quoteLine.record['Group_Total_for_Convenience_Fee__c'] = groupTotal;
			//SET CF
			quoteLine.record['SBQQ__ListPrice__c'] = cf;
			quoteLine.record['SBQQ__NetPrice__c'] = cf;
		}
	});
}

function setSp(quoteLines, quote, cfTotals) {
	const config = new Config();
	quoteLines.forEach(function(quoteLine) {
		var groupTotal = 0;
		var quoteTotal = 0;
		var rate;
		var sp = 0;
		const qlContractTotal = quoteLine.record['Contract_Net_Total_Minus_Support__c'];
		const qlGroupId = quoteLine.record['SBQQ__Group__c'];
		const qlIsExpansion = quoteLine.record['Is_Expansion__c'];
		const qlIsSp = quoteLine.record['Is_Support_Package__c'];
        const qlNetTotal = quoteLine.record['SBQQ__NetTotal__c'];
		const qlProductCode = quoteLine.record['SBQQ__ProductCode__c'];
		//IS SP
		if (qlIsSp) {
			//GET RATE
			if (config.spRateTransform[qlProductCode]) {
				rate = config.spRateTransform[qlProductCode];
				//HAS RATE
				if (rate) {
					//EXPANSION
					if (qlIsExpansion) {
						quoteTotal = (qlContractTotal - qlNetTotal);
						sp = (quoteTotal * rate).toFixed(2);
					}
					//NON-EXPANSION
					else {
						//GROUPS
						if (cfTotals.hasGroups) {
							//MATCHES TO GROUP
							if (cfTotals.groupsTotals[qlGroupId]) {
								groupTotal = (cfTotals.groupsTotals[qlGroupId] - qlNetTotal);
								sp = (groupTotal * rate).toFixed(2);
							}
						}
						//NO GROUPS
						else {
							quoteTotal = (cfTotals.quoteTotal - qlNetTotal);
							sp = (quoteTotal * rate).toFixed(2);
						}
					}
				}
			}
			//LOG
			console.log('groupTotal: ' + groupTotal);
			console.log('quoteTotal: ' + quoteTotal);
			console.log('rate: ' + rate);
			console.log('sp: ' + sp);
			//SET TOTALS
			quote.record['Total_for_Success_Package__c'] = quoteTotal;
			quoteLine.record['Group_Total_for_Success_Package__c'] = groupTotal;
			//SET SP
			quoteLine.record['SBQQ__ListPrice__c'] = sp;
			quoteLine.record['SBQQ__NetPrice__c'] = sp;
		}
	});
}


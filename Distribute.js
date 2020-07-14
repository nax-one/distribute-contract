const crypto = require('crypto.js')


const nasUnit = new BigNumber(10).pow(18)
const naxUnit = new BigNumber(10).pow(9)
const NASPerBlock = new BigNumber(1.18912)


class Utils {

    static getNotNullArray(storage, key) {
        let r = storage.get(key)
        if (!r) {
            r = []
        }
        return r
    }

    static getValue(storage, storageKey, obj, key, defaultValue) {
        if (Utils.isNull(obj[key])) {
            let v = storage.get(storageKey)
            obj[key] = Utils.isNull(v) ? defaultValue : v
        }
        return obj[key]
    }

    static setValue(storage, storageKey, obj, key, value) {
        storage.set(storageKey, value)
        obj[key] = value
    }

    static isNull(o) {
        return typeof o === 'undefined' || o == null
    }

    static verifyBool(o) {
        if (typeof o !== 'boolean') {
            throw new Error(`${o} is not a boolean type`)
        }
    }

    static verifyAddress(address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw new Error(`Not a valid address: ${address}`)
        }
    }

    static verifyAddresses(addresses) {
        if (!addresses || !(addresses instanceof Array) || addresses.length == 0) {
            throw ("addresses list error!")
        }

        if (addresses) {
            addresses.forEach(a => {
                if (a != null) {
                    Utils.verifyAddress(a)
                }
            })
        }
    }

    static transferNAS(to, value) {
        if (!Blockchain.transfer(to, value)) {
            throw new Error('transfer failed.')
        }
    }

}

class Map {
    constructor(storage, key) {
        this.storage = storage
        this._key = key

        this._sizeKey = 'm_' + this._key + '_size'
    }

    _indexKey(idx) {
        return 'm_' + this._key + '_idx_' + idx
    }

    _dataKey(key) {
        return 'm_' + this._key + '_data_' + key
    }

    get(key) {
        return this.storage.get(this._dataKey(key))
    }

    set(key, value) {
        let data = this.storage.get(this._dataKey(key))
        if (data == null) {
            let size = this.size()
            this.storage.set(this._indexKey(size), key)
            this.storage.set(this._sizeKey, size + 1)
        }
        data = value
        this.storage.set(this._dataKey(key), data)
    }

    size() {
        let size = this.storage.get(this._sizeKey)
        return size == null ? 0 : size
    }

    getKeyByIndex(index) {
        if (index < 0 || index >= this.size()) {
            throw new Error('out of key index.')
        }
        return this.storage.get(this._indexKey(index))
    }

    keys() {
        let keys = []
        let count = this.size()
        for (let index = 0; index < count; index++) {
            let key = this.storage.get(this._indexKey(index))
            keys.push(key)
        }
        return keys
    }
}

class BaseContract {

    constructor(name) {
        this.__contractName = name
        LocalContractStorage.defineProperty(this, '_config', null)
    }

    get config() {
        if (!this.__config) {
            this.__config = this._config
        }
        return this.__config
    }

    set config(config) {
        this.__config = config
        this._config = config
    }

    init(multiSig) {
        this._verifyAddress(multiSig)
        this.config = {
            multiSig: multiSig
        }
    }

    setConfig(config) {
        this._verifyFromMultiSig()
        this.config = config
    }

    getConfig() {
        return this.config
    }

    _verifyFromMultiSig() {
        if (Blockchain.transaction.from !== this.config.multiSig) {
            throw new Error('No permissions.')
        }
    }

    _verifyFromAssetManager() {
        if (this.config.assetManagers.indexOf(Blockchain.transaction.from) < 0) {
            throw new Error('No permissions.')
        }
    }

    _verifyFromDataManager() {
        if (this.config.dataManagers.indexOf(Blockchain.transaction.from) < 0) {
            throw new Error('No permissions.')
        }
    }

    _verifyAddress(address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw new Error(`Not a valid address: ${address}`);
        }
    }

}

class NodeDistribute {
    constructor(storage, node) {
        this.storage = storage
        this.node = node

        this.votes = new Map(storage, 'vd_' + this.node.nodeId + '_v')
    }

    get lastDistributeKey() {
        return 'vd_' + this.node.nodeId + '_last_d_k'
    }

    get balanceKey() {
        return 'vd_' + this.node.nodeId + '_b'
    }

    get chargeCountKey() {
        return 'vd_' + this.node.nodeId + '_c_c'
    }

    get needRewardKey() {
        return 'vd_' + this.node.nodeId + 'n_r'
    }

    _chargeHistoryKey(index) {
        index = index == null ? 0 : index
        return 'vd_' + this.node.nodeId + '_c_h:' + index
    }

    _incomeKey(period, addr) {
        return 'vd_' + this.node.nodeId + '_in:' + period + ':' + addr
    }

    _weightedVote(value) {
        let weight = 1
        if (this.node.plan.options) {
            let temp = 0
            let naxValue = new BigNumber(value).div(naxUnit)
            for(let key in this.node.plan.options) {
                if(naxValue.gte(key) && new BigNumber(key).gt(temp)) {
                    temp = key
                    weight = this.node.plan.options[key]
                }
            }
        }
        return new BigNumber(value).times(weight).toString(10)
    }

    checkManagers() {
        if (this.node.managers.indexOf(Blockchain.transaction.from) < 0) {
            throw ("node manager permission Denied!")
        }
    }

    track(period, blockCount, votes) {
        if (period < this.node.plan.start) {
            throw new Error('distribute not start')
        }

        this.votes.set(period, {count: blockCount, timestamp: Blockchain.block.timestamp, votes: votes})
    }

    distribute() {
        this.checkManagers()

        let voteSize = this.votes.size()
        if (voteSize <= 1) {
            throw new Error('distribute must after the track votes.')
        }

        let last = this.storage.get(this.lastDistributeKey)
        if (last == null) {
            last = this.votes.getKeyByIndex(0)
        }

        let end = this.votes.getKeyByIndex(voteSize - 1)
        if (last == end) {
            throw new Error('all tracks has distributed.')
        }

        let needRewards = this.storage.get(this.needRewardKey)
        if (!needRewards) {
            needRewards = []
        }

        let lastData = this.votes.get(last)
        let blockCount = lastData.count

        let temp = last
        let keys = this.votes.keys()
        let cache = {}
        cache[temp] = lastData
        keys.forEach(period => {
            if (period > temp) {
                let data = this.votes.get(period)
                cache[period] = data

                let lastVotes = cache[temp].votes

                let total = new BigNumber(0)
                data.votes.forEach(vote => {
                    for (let key in lastVotes) {
                        if (lastVotes[key].address == vote.address) {
                            vote.lastFound = true
                            break
                        }
                    }

                    if (vote.lastFound) {
                        vote.weightedVote = this._weightedVote(vote.value)
                        total = total.plus(vote.weightedVote)
                    }
                })

                let count = data.count - blockCount
                let distributeAmount = new BigNumber(NASPerBlock).times(count).times(this.node.plan.rate)
                data.votes.forEach(vote => {
                    if (vote.lastFound) {
                        let amount = new BigNumber(vote.weightedVote).times(distributeAmount).div(total)
                        amount = amount.times(100).floor().div(100).toString(10)
                        let income = {
                            start: temp,
                            end: period,
                            distributeTimestamp: Blockchain.block.timestamp,
                            vote: new BigNumber(vote.value).div(naxUnit).toString(10),
                            weightedVote: vote.weightedVote,
                            blockCount: count,
                            value: amount,
                            transfered: false
                        }
                        this.storage.set(this._incomeKey(period, vote.address), income)
                    }
                })
                temp = period
                blockCount = data.count
                needRewards.push(period)
            }
        })

        if (temp > last) {
            this.storage.set(this.lastDistributeKey, temp)
            this.storage.set(this.needRewardKey, needRewards)
        }
        return temp - last
    }

    transferReward(period) {
        this.checkManagers()

        let data = this.votes.get(period)
        if (data == null) {
            throw new Error('this period not track.')
        }
        data.votes.forEach(vote => {
            this.transferAddressReward(period, vote.address)
        })

        let needRewards = this.storage.get(this.needRewardKey)
        let updateRewards = []
        needRewards.forEach(np => {
            if (np != period) {
                updateRewards.push(np)
            }
        })
        this.storage.set(this.needRewardKey, updateRewards)
    }

    transferAddressReward(period, addr) {
        let income = this.getAddressIncome(period, addr)
        if (income == null) {
            return
        }
        if (income.transfered) {
            throw new Error(`${addr} has transfered in ${period}.`)
        }


        income.transfered = true
        income.transferTimestamp = Blockchain.block.timestamp

        if (new BigNumber(income.value).gt(0)) {
            let value = new BigNumber(income.value).times(nasUnit)
            Utils.transferNAS(addr, value)

            let balance = this.storage.get(this.balanceKey)
            if (!balance || new BigNumber(balance).lt(value)) {
                throw new Error('insufficient node balance.')
            }
            balance = new BigNumber(balance).sub(value)
            this.storage.set(this.balanceKey, balance.toString(10))

            Event.Trigger("transferAddressReward", income)
        }

        this.storage.set(this._incomeKey(period, addr), income)
    }

    charge(from, value) {
        let count = this.storage.get(this.chargeCountKey)
        count = count ? count : 0
        let charge = {
            index: count,
            from: from,
            value: new BigNumber(value).toString(10),
            timestamp: Blockchain.block.timestamp
        }
        this.storage.set(this._chargeHistoryKey(count), charge)
        this.storage.set(this.chargeCountKey, count+1)

        let balance = this.storage.get(this.balanceKey)
        balance = balance ? new BigNumber(balance) : new BigNumber(0)
        this.storage.set(this.balanceKey, balance.add(value).toString(10))

        Event.Trigger("charge", charge)
    }

    withdraw(addr, value) {
        this.checkManagers()

        let balance = this.getBalance()
        if (!balance || new BigNumber(balance).lt(value)) {
            throw new Error('insufficient withdraw balance.')
        }

        Utils.transferNAS(addr, value)
        balance = new BigNumber(balance).sub(value).toString(10)
        this.storage.set(this.balanceKey, balance)

        Event.Trigger("withdraw", {
            from: Blockchain.transaction.to,
            to: addr,
            value: value
        })
    }

    getPeriods() {
        return this.votes.keys()
    }

    getVotes(period) {
        return this.votes.get(period)
    }

    getIncomes(period) {
        let data = this.votes.get(period)
        if (data == null) {
            throw new Error('this period not track.')
        }
        let addrs = []
        data.votes.forEach(vote => {
            addrs.push(vote.address)
        })
        let incomes = []
        addrs.forEach(addr => {
            let income = this.getAddressIncome(period, addr)
            if (income) {
                income.address = addr
                incomes.push(income)
            }
        })
        return incomes
    }

    getAddressIncome(period, addr) {
        return this.storage.get(this._incomeKey(period, addr))
    }

    getBalance() {
        let balance = this.storage.get(this.balanceKey)
        balance = balance ? balance : "0"
        return balance
    }

    getChargeHistory() {
        let count = this.storage.get(this.chargeCountKey)
        if (count == null) {
            return []
        }

        let history = []
        for (let index = 0; index < count; index++) {
            history.push(this.storage.get(this._chargeHistoryKey(index)))
        }
        return history
    }

    getToReward() {
        let needRewards = this.storage.get(this.needRewardKey)
        if (!needRewards || needRewards.length == 0) {
            return {total: '0'}
        }

        let total = new BigNumber(0)
        let rewards = []
        needRewards.forEach(period => {
            let data = this.votes.get(period)
            let reward = {
                period: period,
                data: []
            }
            data.votes.forEach(vote => {
                let income = this.storage.get(this._incomeKey(period, vote.address))
                if (income && !income.transfered) {
                    total = total.add(income.value)
                    income.addr = vote.address
                    reward.data.push(income)
                }
            })
            rewards.push(reward)
        })

        return {
            total: total.toString(10),
            data: rewards
        }
    }

    prospectiveIncome(value) {
        if (this.votes.size() <= 1) {
            throw new Error('prospective must after the track votes.')
        }

        let size = this.votes.size()
        let last = this.votes.getKeyByIndex(size - 2)
        let next = this.votes.getKeyByIndex(size - 1)
        let lastData = this.votes.get(last)
        let nextData = this.votes.get(next)

        let total = new BigNumber(0)
        nextData.votes.forEach(vote => {
            vote.weightedVote = this._weightedVote(vote.value)
            total = total.plus(vote.weightedVote)
        })

        let weightedVote = this._weightedVote(value)
        total = total.plus(weightedVote)

        let count = nextData.count - lastData.count
        let distributeAmount = new BigNumber(NASPerBlock).times(count).times(this.node.plan.rate)
        let amount = distributeAmount.times(weightedVote).div(total).toFixed(5)
        return {
            start: last,
            end: next,
            vote: value,
            blockCount: count,
            value: amount
        }
    }
}

/*
config = {
    multiSig:
    assetManagers:
    dataManagers:
    nodeProxy:
}
*/
class Distribute extends BaseContract {
    constructor() {
        super('Distribute')

        LocalContractStorage.defineMapProperty(this, 'storage', null)
        this._nodes = new Map(this.storage, 'nodes')
    }

    get nodeContract() {
        if (Utils.isNull(this._nodeContract)) {
            if (Utils.isNull(this.config.nodeProxy)) {
                throw new Error('config.nodeProxy not found.')
            }
            this._nodeContract = new Blockchain.Contract(this.config.nodeProxy)
        }
        return this._nodeContract
    }

    _node(nodeId) {
        if (!this.__nodes) {
            this.__nodes = {}
        }
        if (!this.__nodes.nodeId) {
            let node = this._nodes.get(nodeId)
            if (node == null) {
                throw new Error('node not registered.')
            }
            node.nodeId = nodeId
            this.__nodes.nodeId = new NodeDistribute(this.storage, node)
        }
        return this.__nodes.nodeId
    }

    track(nodeId) {
        let node = this.nodeContract.call('getNodeDetail', nodeId)
        this._track(node)
    }

    _track(node) {
        let sysInfo = this.nodeContract.call('getSystemInfo')
        let voteData = this.nodeContract.call('getNodeVoteStatistic', node.id)
        this._node(node.id).track(sysInfo.currentPeriod, node.blockCount, voteData)
    }

    distribute(nodeId) {
        this.track(nodeId)
        return this._node(nodeId).distribute()
    }

    charge(nodeId) {
        if (Blockchain.transaction.value.gt(0)) {
            this._node(nodeId).charge(Blockchain.transaction.from, Blockchain.transaction.value)
        }
    }

    withdraw(nodeId, addr, value) {
        Utils.verifyAddress(addr)

        this._node(nodeId).withdraw(addr, value)
    }

    transferReward(nodeId, period) {
        if (Blockchain.transaction.value.gt(0)) {
            this._node(nodeId).charge(Blockchain.transaction.from, Blockchain.transaction.value)
        }

        this._node(nodeId).transferReward(period)
    }

    _checkPlan(plan) {
        if (plan.start == null) {
            throw new Error('plan need.')
        }

        if(!plan.rate || plan.rate > 1) {
            throw new Error('rate need be 0~1')
        }
    }

    /*
    plan {
        start: 1, //开始分配收益周期
        coinbase: false, //如果合约为coinbase，不需要充值
        rate: 0.5,//出块奖励分配比例
        options: { //按投票数对高投票人额外奖励比例
            1000: 1,
            100000: 1.1,
            1000000: 1.2,
        }
    }
     */
    register(nodeId, managers, plan) {
        Utils.verifyAddresses(managers)
        this._checkPlan(plan)

        let old = this._nodes.get(nodeId)
        if (old != null) {
            throw new Error('node has registered.')
        }

        let node = this.nodeContract.call('getNodeDetail', nodeId)
        if (node.accounts.registrant != Blockchain.transaction.from) {
            throw new Error('Only the node registration address can be registered.')
        }

        this._nodes.set(nodeId, {managers: managers, plan: plan})

        this._track(node)
    }

    update(nodeId, managers, plan) {
        Utils.verifyAddresses(managers)
        this._checkPlan(plan)

        this._node(nodeId).checkManagers()

        let node = this._nodes.get(nodeId)
        node.managers = managers
        node.plan = plan
        this._nodes.set(nodeId, node)
    }

    getNodes() {
        return this._nodes.keys()
    }

    getNodeConf(nodeId) {
        return this._nodes.get(nodeId)
    }

    getNodePeriods(nodeId) {
        return this._node(nodeId).getPeriods()
    }

    getNodeVotes(nodeId, period) {
        return this._node(nodeId).getVotes(period)
    }

    getNodeIncomes(nodeId, period) {
        return this._node(nodeId).getIncomes(period)
    }

    getNodePeriodAddrIncome(nodeId, period, addr) {
        return this._node(nodeId).getAddressIncome(period, addr)
    }

    getNodeAddrIncome(nodeId, addr) {
        let incomes = []
        let periods = this.getNodePeriods(nodeId)
        periods.forEach(period => {
            let income = this.getNodePeriodAddrIncome(nodeId, period, addr)
            if (income) {
                income.period = period
                incomes.push(income)
            }
        })
        return incomes
    }

    getAddressIncome(addr) {
        let nodeIds = this._nodes.keys()
        let datas = []
        nodeIds.forEach(nodeId => {
            let data = {
                nodeId: nodeId,
                incomes: []
            }
            let periods = this.getNodePeriods(nodeId)
            periods.forEach(period => {
                let income = this.getNodePeriodAddrIncome(nodeId, period, addr)
                if (income) {
                    income.period = period
                    data.incomes.push(income)
                }
            })
            if (data.incomes.length > 0) {
                datas.push(data)
            }
        })
        return datas
    }

    getNodeBalance(nodeId) {
        return this._node(nodeId).getBalance()
    }

    getNodeCharge(nodeId) {
        return this._node(nodeId).getChargeHistory()
    }

    getNodeToReward(nodeId) {
        return this._node(nodeId).getToReward()
    }

    prospectiveIncome(nodeId, value) {
        return this._node(nodeId).prospectiveIncome(value)
    }

    accept() {
        Event.Trigger('transfer', {
            from: Blockchain.transaction.from,
            to: Blockchain.transaction.to,
            value: Blockchain.transaction.value,
        })
    }

    transferFund(toAddr, nas) {
        if (!toAddr) {
            toAddr = Blockchain.transaction.from
        }
        this._verifyFromAssetManager()
        if (!Blockchain.transfer(toAddr, nas)) {
            throw new Error('transfer failed.')
        }
        Event.Trigger("transferFund", {
            from: Blockchain.transaction.to,
            to: toAddr,
            value: nas
        })
    }

}


module.exports = Distribute

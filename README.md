# distribute-contract

### 合约初始化
```javascript
/*
@params
    manager: //管理员地址
*/
init(manager)
```

### 合约设置
```javascript
/*
@params
    config: //合约配置项
        {
            multiSig: manager, 
            assetManagers: [manager], 
            dataManagers:[manager],
            nodeProxy: NodeProxyContract
        }
*/
setConfig(config)
```

### 1. 注册节点分发

权限：节点平台注册地址

```javascript
/*
@param
nodeId: 节点ID
managers: 节点管理地址，可更新节点发放规则
plan:
    {
        start: 1, //开始分配收益周期
        rate: 0.5,//出块奖励分配比例
        options: { //按投票数对高投票人额外奖励比例
            1000: 1,    //正常1倍
            100000: 1.1,    //按1.1倍发放
            1000000: 1.2,   //按1.2倍发放
        }
    }
*/
register(nodeId, managers, plan)
```

### 2. 修改节点分发

权限：节点管理地址

```javascript
update(nodeId, managers, plan)
```

### 3. 统计节点投票及出块信息
```javascript
track(nodeId)
```

### 4. 计算分发金额

权限：节点管理地址

```javascript
//计算前会统计当前周期，3接口可不调用
distribute(nodeId) 
```

### 5. 合约发放奖励

权限：节点管理地址

```javascript
/*
@params
nodeId:
period:节点统计投票周期，可通过`getNodePeriods`查询
*/
transferReward(nodeId, period)
```

### 6. 分发注册节点列表
```javascript
getNodes()
```

### 7. 获取节点分发规则
```javascript
/**
 * 返回节点分发规则
 * @param {*} nodeId
 * @return {*} 
   {
      manager: manager_addr,
      {
          start: 1, //开始分配收益周期
          rate: 0.5,//出块奖励分配比例
          options: { //按投票数对高投票人额外奖励比例
              1000: 1,    //正常1倍
              100000: 1.1,    //按1.1倍发放
              1000000: 1.2,   //按1.2倍发放
          }
      }
   }
 */
getNodeConf(nodeId)
```

### 8. 获取节点投票及出块周期列表
```javascript
getNodePeriods(nodeId)
```

### 9. 获取节点投票信息
```javascript
getNodeVotes(nodeId, period)
```

### 10. 获取节点投票收益
```javascript
getNodeIncomes(nodeId, period)
```

### 11. 获取节点地址收益
```javascript
/*
@params
    nodeId: //节点ID
    period: //发放对应周期
    addr: //地址
@return
    {
        "start":2461,   //奖励起始周期,
        "end": 2642,    //奖励结束周期（不包含该周期出块）
        trackTimestamp: xxx,
        distributeTimestamp: xxx,
        "vote": 10000,  //投票数，单位nax
        "blockCount":0, //出块数
        "value":"0.00000", //奖励金额
        "transfered":false  //奖励是否已通过合约发放
    }

*/
getNodePeriodAddrIncome(nodeId, period, addr)

getNodeAddrIncome(nodeId, addr)
```

### 12. 获取地址总收益
```javascript
getAddressIncome(addr)
```

### 13. 取回合约内nas
```javascript
transferFund(toAddr, nas)
```

### 14. 当前预期收益

根据该节点的上一个收益统计周期计算

```javascript
/*
按当前投票排名模拟发放金额
@params
    nodeId:
    value: 投票nax金额，单位：nax
@return
    {
        "start":2461,   //奖励起始周期
        "end": 2642,    //奖励结束周期（不包含该周期出块）
        "vote": 10000,  //投票数，单位nax
        "blockCount":0, //出块数
        "value":"0.00000" //奖励金额
    }
*/
prospectiveIncome(nodeId, value)
```

### 15. 节点充值，用于发放奖励
```javascript
charge(nodeId)
```

### 16. 获取节点余额
```javascript
getNodeBalance(nodeId)
```

### 17. 获取节点充值记录
```javascript
getNodeCharge(nodeId)
```

### 18. 节点取回NAS余款

权限：节点管理地址

```javascript
withdraw(nodeId, addr, value) 
```

### 19. 查询节点待发放的奖励

```javascript
getNodeToReward(nodeId) 
```
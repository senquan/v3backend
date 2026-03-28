export enum TrackingRequestType {
  INTERCEPTION = 1,  // 拦截请求
  REJECT = 2,        // 拒收
  NO_RECEIVE = 3,    // 未收到
  DAMAGE = 4,        // 破损
  LOST = 5,          // 丢件
  ADDR_ISSUE = 6     // 地址异常
}
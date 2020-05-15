export const calculateIpSums = (items: any, minutes: number) => {
  return items
    .filter((item: any) => {
      // @ts-ignore
      const msDiff = (Date.now() - new Date(item.request.date))
      const minutesDiff = msDiff / 1000 / 60
      return minutesDiff < minutes
    })
    .map((i: any) => ({
      ipAddress: i.request.ipAddress,
      amount: i.response.amountSentInDash
    }))
    .reduce((builtObj: any, currObj: any) => {
      const ipAddSum = builtObj[currObj.ipAddress] || 0
      const newAmount = ipAddSum + currObj.amount
      builtObj[currObj.ipAddress] = newAmount
      return builtObj
    }, {})
}

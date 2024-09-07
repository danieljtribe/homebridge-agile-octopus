export type SearchPeriod = {
    id: string,
    title: string,
    blocks: number,
    contiguous: boolean,
    startTime?: Number,
    endTime?: Number
}

export type CustomDevice = {
    name: string,
    hours: string,
    startTime: string,
    endTime: string,
    combineSlots: boolean
}
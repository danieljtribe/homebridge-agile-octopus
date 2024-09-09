import { Moment } from "moment"

export type OctopusAPITimeslotResponse = {
    value_exc_vat: Number,
    value_inc_vat: Number,
    valid_from: String,
    valid_to: String,
    payment_method: null,
    startMoment: Moment,
    endMoment: Moment
}
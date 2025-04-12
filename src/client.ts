import {
    ApiConstants, HeartbeatErrorPayload, HeartbeatWarningPayload,
    HistorySummaryResponse, NewHistoryPayload,
    PropsFilter, StreamOptions, TimetableOptions, TimetableResponse, TrainHistoryOptions,
    TrainHistoryResponse, TrainOptions,
    TrainResponse,
    TrainsOptions,
    TrainsResponse
} from "./types";
import {createEventSource} from 'eventsource-client'

function serializeProps(props: PropsFilter) {
    return props.join(',');
}

function deserializeCollatedTrain(train: any) {
    const copy = structuredClone(train);
    if (copy.timesAPI) {
        copy.timesAPI.lastEvent.time = new Date(copy.timesAPI.lastEvent.time);
        for (const plannedDestination of copy.timesAPI.plannedDestinations) {
            plannedDestination.fromTime = new Date(plannedDestination.fromTime);
        }
        for (const nextStation of copy.timesAPI.nextStations) {
            if (nextStation.time.actualScheduledTime) {
                nextStation.time.actualScheduledTime = new Date(nextStation.time.actualScheduledTime);
            }
            nextStation.time.actualPredictedTime = new Date(nextStation.time.actualPredictedTime);
        }
    }
    return copy;
}

function deserializeHistoryEntry(historyEntry: any) {
    const copy = structuredClone(historyEntry);
    copy.date = new Date(copy.date);
    return copy;
}

function deserializeTrainHistorySummary(historySummary: any) {
    const copy = structuredClone(historySummary);
    copy.firstEntry = new Date(copy.firstEntry);
    copy.lastEntry = new Date(copy.lastEntry);
    return copy;
}

export class MetroApiClient {
    constructor(private readonly baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async getConstants(): Promise<ApiConstants> {
        const response = await fetch(`${this.baseUrl}/constants`);
        return response.json();
    }

    async getTrains(opts: TrainsOptions): Promise<TrainsResponse> {
        const queryParams = new URLSearchParams();
        if (opts.props) {
          queryParams.append('props', serializeProps(opts.props));
        }
        const response = await fetch(`${this.baseUrl}/trains?${queryParams}`);
        const data = await response.json();
        if (data.lastChecked) {
            data.lastChecked = new Date(data.lastChecked);
        }
        if (data.trains && !Array.isArray(data.trains)) {
            for (const train of data.trains) {
                if (train.status) {
                    train.status = deserializeCollatedTrain(train);
                }
                if (train.lastChanged) {
                    train.lastChanged = new Date(train.lastChanged);
                }
            }
        }
        return data;
    }

    async getTrain(trn: string, opts: TrainOptions): Promise<TrainResponse> {
        const queryParams = new URLSearchParams();
        if (opts.props) {
          queryParams.append('props', serializeProps(opts.props));
        }
        const response = await fetch(`${this.baseUrl}/train/${trn}?${queryParams}`);
        const data = await response.json();
        if (data.lastChecked) {
            data.lastChecked = new Date(data.lastChecked);
        }
        if (data.lastChanged) {
            data.lastChanged = new Date(data.lastChanged);
        }
        if (data.status) {
            data.status = deserializeCollatedTrain(data.status);
        }
        return data;
    }

    async getHistorySummary(): Promise<HistorySummaryResponse> {
        const response = await fetch(`${this.baseUrl}/history`);
        const data = await response.json();
        data.lastChecked = new Date(data.lastChecked);
        for (const trn of Object.keys(data.trains)) {
            data.trains[trn] = deserializeTrainHistorySummary(data.trains[trn]);
        }
        return data;
    }

    async getHistory(trn: string, opts: TrainHistoryOptions): Promise<TrainHistoryResponse> {
        const queryParams = new URLSearchParams();
        if (opts.time) {
            let from = '';
            let to = '';
            if ('from' in opts.time) {
                from = opts.time.from.getTime().toString()
            }
            if ('to' in opts.time) {
                to = opts.time.to.getTime().toString()
            }
            queryParams.append('time', `${from}...${to}`);
        }
        if (opts.limit) {
            queryParams.append('limit', opts.limit.toString());
        }
        if (opts.active) {
            queryParams.append('active', opts.active ? '1' : '0');
        }
        if (opts.props) {
          queryParams.append('props', serializeProps(opts.props));
        }
        const response = await fetch(`${this.baseUrl}/history/${trn}?${queryParams}`);
        const data = await response.json();
        if (data.lastChecked) {
            data.lastChecked = new Date(data.lastChecked);
        }
        if (data.summary) {
            data.summary = deserializeTrainHistorySummary(data.summary);
        }
        if (data.extract) {
            data.extract = data.extract.map(deserializeHistoryEntry);
        }
        return data;
    }

    async getTimetable<Options extends TimetableOptions>(opts: Options):
        Promise<TimetableResponse<
                Options['trn'] extends string ? false : true,
                Options['station'] extends string ? false : true
        >>
    {
        const queryParams = new URLSearchParams();
        for (const opt of ['day', 'trn', 'station', 'direction', 'emptyManeuvers'] as const) {
            if (opts[opt]) {
                queryParams.append(opt, opts[opt].toString());
            }
        }
        if (opts.emptyManeuverProps) {
            queryParams.append('emptyManeuverProps', serializeProps(opts.emptyManeuverProps));
        }
        if (opts.tableProps) {
            queryParams.append('tableProps', serializeProps(opts.tableProps));
        }
        const response = await fetch(`${this.baseUrl}/timetable?${queryParams}`);
        return response.json();
    }

    stream(
        opts: StreamOptions,
        callbacks: {
            onNewHistory?: (data: NewHistoryPayload) => void,
            onHeartbeatError?: (data: HeartbeatErrorPayload) => void,
            onHeartbeatWarning?: (data: HeartbeatWarningPayload) => void,
            onConnect?: () => void,
            onDisconnect?: () => void,
            onScheduleReconnect?: (info: { delay: number }) => void
        }
    ): {
        close(): void;
        connect(): void;
    } {
        const queryParams = new URLSearchParams();
        queryParams.append('type', opts.type);
        if (opts.type === "trains") {
            if (opts.trns) {
                queryParams.append('trains', opts.trns.join(','));
            }
        } else if (opts.type === "errors") {
            if (opts.warnings) {
                queryParams.append('warnings', '');
            }
            if (opts.apis) {
                queryParams.append('apis', opts.apis.join(','));
            }
        }
        const url = `${this.baseUrl}/stream?${queryParams}`;
        return createEventSource({
            url,
            ...callbacks,
            onMessage: (event) => {
                const data = JSON.parse(event.data);
                switch (event.event) {
                    case 'new-history':
                        if (data.date) {
                            data.date = new Date(data.date);
                        }
                        callbacks.onNewHistory?.(data);
                        break;
                    case 'heartbeat-error':
                        callbacks.onHeartbeatError?.(data);
                        break;
                    case 'heartbeat-warning':
                        callbacks.onHeartbeatWarning?.(data);
                        break;
                }
            }
        });
    }
}

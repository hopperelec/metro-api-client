// --- Props filtering ---

/**
 * A list of properties, which are themselves dot-separated lists of keys.
 * To only select keys of a record, use the `"keys"` property; for example, `?props=trains.keys`.
 * For arrays or records, keys will be filtered on each element instead.
 * If no properties are specified, all properties will be included.
 */
export type PropsFilter = string[];

/** Interface for responses allowing filtering of properties. */
export interface FilterableProps {
    /** Properties to include in the response. */
    props?: PropsFilter;
}

// See: https://stackoverflow.com/a/51365037/17168710
type RecursivePartial<T> = {
    [P in keyof T]?:
    T[P] extends (infer U)[] ? RecursivePartial<U>[] :
        T[P] extends object | undefined ? RecursivePartial<T[P]> :
            T[P];
};

// --- Underlying API Related Types ---

/** Information about a train derived from the Times API. */
export interface TimesApiData {
    /** Last event for the train. */
    lastEvent: {
        /** Type of the last event (e.g., `"APPROACHING"`, `"ARRIVED"`). */
        type: string;
        /** Name of the station where the last event occurred. */
        station: string;
        /** Platform number of the last event. */
        platform: number;
        /** Time of the last event. */
        time: Date;
    };
    /** List of planned destinations, in order. */
    plannedDestinations: {
        /** Name of the destination station. */
        name: string;
        /** The code of the station where this is expected to become the current destination. */
        fromStation: string;
        /** When this is expected to become the current destination. */
        fromTime: Date;
    }[];
    /** List of next stations, in order of planned arrival. */
    nextStations: {
        /** Code of the station. */
        station: string;
        /** When the train is expected to arrive at this station. */
        time: {
            /** In how many minutes the train is due. `0` for "Due", `-1` for "Arrived", `-2` for "Delayed". */
            dueIn: number;
            /** The scheduled time, according to Nexus, or null. */
            actualScheduledTime: Date | null;
            /** The predicted time, according to Nexus. */
            actualPredictedTime: Date;
        };
    }[];
}

/** Information about a train derived from the Train Statuses API. */
export interface TrainStatusesApiData {
    /** Name of the destination. */
    destination: string;
    /** Last seen status string (e.g., "Arrived Monument platform 3 at 12:34"). */
    lastSeen: string;
}

/** Collated train data from one or both APIs. */
export type CollatedTrain =
    | { timesAPI: TimesApiData; trainStatusesAPI?: TrainStatusesApiData }
    | { timesAPI?: TimesApiData; trainStatusesAPI: TrainStatusesApiData };

// --- History Related Types ---

/** The status of a train in the history. Notably omits nextStations from TimesApiData. */
export type ActiveHistoryStatus =
    | { timesAPI: Omit<TimesApiData, "nextStations">; trainStatusesAPI?: TrainStatusesApiData }
    | { timesAPI?: Omit<TimesApiData, "nextStations">; trainStatusesAPI: TrainStatusesApiData }

/** Base interface for a single entry in a train's history. */
export interface BaseHistoryEntry {
    /** Time of the history entry. */
    date: Date;
    /** Whether the train was active at this time. */
    active: boolean;
}

/** A single entry in a train's history when the train is inactive. */
export interface InactiveHistoryEntry extends BaseHistoryEntry {
    active: false;
}

/** A single entry in a train's history when the train is active. */
export interface ActiveHistoryEntry extends BaseHistoryEntry {
    active: true;
    /** The train's status at this time */
    status: ActiveHistoryStatus;
}

/** A single entry in a train's history. */
export type HistoryEntry = ActiveHistoryEntry | InactiveHistoryEntry;

/** Summary of a train's history. */
export interface TrainHistorySummary {
    /** Number of history entries available. */
    numEntries: number;
    /** When the first entry was made. */
    firstEntry: Date;
    /** When the last entry was made. */
    lastEntry: Date;
}

// --- `/constants` Endpoint ---

/** Response from the `/constants` endpoint. */
export interface ApiConstants<
    StationCodes extends Record<string, string> = Record<string, string>,
    Lines extends Record<string, (keyof StationCodes)[]> = Record<string, (keyof StationCodes)[]>,
> {
    /** Hour at which the timetable resets to the next day (0-23). */
    NEW_DAY_HOUR: number;
    /** Interval at which history is always updated */
    PASSIVE_REFRESH_INTERVAL: number;
    /** Minimum time between updates to the history, such as when a request is made for a train's current status */
    ACTIVE_REFRESH_MINIMUM_TIMEOUT: number;
    /* Maximum number of history entries kept per train, before old entries are purged */
    MAX_HISTORY_LENGTH: number;
    /** Maximum age of history entries, in milliseconds, before being purged */
    MAX_HISTORY_AGE: number;
    /** Maximum number of history entries (limit) returned by `/history/:trn` */
    MAX_HISTORY_REQUEST_LIMIT: number;
    /** Default number of history entries (limit) returned by `/history/:trn` if no limit is specified */
    DEFAULT_HISTORY_REQUEST_LIMIT: number;
    /** List of "station" codes where trains may be timetabled to stop at, but not while holding passengers, such as sidings */
    NIS_STATIONS: (keyof StationCodes)[];
    /** Map of lines and the stations on them */
    LINES: Lines;
    /** Map from station codes to human-readable names */
    STATION_CODES: StationCodes;
    /**
     * Map from line -> direction -> station code -> route code
     * Note that not every station will have a known route code.
     */
    ROUTE_CODES: Record<keyof Lines, Record<TrainDirection, Record<keyof StationCodes, number>>>;
}

// --- `/trains` Endpoint ---

/** Options for the `/trains` endpoint */
export interface TrainsOptions extends FilterableProps {}

/** Response from the `/trains` endpoint, assuming all properties are present. */
export interface FullTrainsResponse {
    /** Time of the last heartbeat */
    lastChecked: Date;
    /** List of all active trains */
    trains: Record<string, {
        /** The train's current status */
        status: CollatedTrain;
        /** When this train's status last changed */
        lastChanged: Date;
    }>;
}

/** Response from the `/trains` endpoint. */
export type TrainsResponse = RecursivePartial<FullTrainsResponse>;

// --- `/train/:trn` Endpoint ---

/** Options for the `/train/:trn` endpoint */
export interface TrainOptions extends FilterableProps {}

/**
 * Expected timetabled location for a train.
 * The train should be at or between `station1` and `station2`.
 *
 * If the train is not expected to be in service yet, `station1`, `station2` and `destination`
 * will all be the name of the arrival/departure `place` (e.g. `"Gosforth Depot"`)
 */
export interface ExpectedTrainLocation {
    /** Station code (e.g., `"MTS"`) or arrival/departure `place` (e.g., `"Gosforth Depot"`) */
    station1: string;
    /** Station code (e.g., `"CEN"`) or arrival/departure `place` (e.g., `"Gosforth Depot"`) */
    station2: string;
    /** Station code (e.g., `"SSS"`) or arrival/departure `place` (e.g., `"Gosforth Depot"`) */
    destination: string;
}

/** Base interface for `/train/:trn` endpoint response. */
export interface BaseTrainResponse {
    /** Time of the last heartbeat */
    lastChecked: Date;
    /** When this train's status last changed, or null if this train has not been seen recently */
    lastChanged: Date | null;
    /** Whether the train is currently active */
    active: boolean;
    /** Expected location of the train, or null if the train is not timetabled to be in service */
    timetable: ExpectedTrainLocation | null;
}

/** `/train/:trn` endpoint response for an inactive train. */
export interface InactiveTrainStatus extends BaseTrainResponse {
    active: false;
}

/** `/train/:trn` endpoint response for an active train. */
export interface ActiveTrainStatus extends BaseTrainResponse {
    active: true;
    /** The train's current status */
    status: CollatedTrain;
}

/** Response from the `/train/:trn` endpoint, assuming all properties are present. */
export type FullTrainResponse = InactiveTrainStatus | ActiveTrainStatus;

/** Response from the `/train/:trn` endpoint. */
export type TrainResponse = RecursivePartial<FullTrainResponse>;

// --- `/history` Endpoint ---

export interface HistorySummaryResponse {
    /** Time of the last heartbeat */
    lastChecked: Date;
    /** Map of train running numbers (TRNs, without the leading "T", e.g. "101") to their history summaries */
    trains: Record<string, TrainHistorySummary>;
}

// --- `/history/:trn` Endpoint

/** Options for `/history/:trn` endpoint */
export interface TrainHistoryOptions {
    /** Range of time to get the history for */
    time?:
        | { from: Date; }
        | { to: Date; }
        | { from: Date; to: Date; };
    /**
     * Limit the number of results.
     * Check `/constants` for the default and maximum values.
     */
    limit?: number;
    /**
     * Filter by active state.
     * `true`: Only include entries where the train was active.
     * `false`: Only include entries marking transitions between active/inactive.
     * `undefined` (default): Include all entries.
     */
    active?: boolean;
    /** Property filter string. */
    props?: PropsFilter;
}

/** Response from the `/history/:trn` endpoint, assuming all properties are present. */
export interface FullTrainHistoryResponse {
    /** Time of the last heartbeat */
    lastChecked: Date;
    /** A summary of the train's history. */
    summary: TrainHistorySummary;
    /** The selected history entries. */
    extract: HistoryEntry[];
}

/** Response from the `/history/:trn` endpoint. */
export type TrainHistoryResponse = RecursivePartial<FullTrainHistoryResponse>;

// --- `/timetable` Endpoint ---

/** Arrival/Departure time in "HHMMSS" format. */
export type ArrivalTime = string;

/** Direction of a train. */
export type TrainDirection = "in" | "out";

export interface BaseRoute {
    /** Code which identifies the destination and line. */
    code: number;
}

/** A route in the timetable, including all stations and their expected arrival times. */
export interface AllStationsRoute extends BaseRoute {
    /** Map of stations and their expected arrival times. */
    stations: Record<string, ArrivalTime>;
}

/** A route in the timetable and the expected arrival time at a specific station. */
export interface SingleStationRoute extends BaseRoute {
    /** The expected arrival time at the requested station. */
    time: ArrivalTime;
}

/** Timetable information for a single train on a specific day type. */
export interface TrainTimetable<Route extends BaseRoute = AllStationsRoute> {
    /** The maneuver the train does before starting service. */
    departure: {
        /** Where the maneuver starts (e.g., `"Gosforth Depot"`) */
        place: string;
        /** The time the maneuver starts, in "HHMM" format */
        time: string;
        /** A description of the maneuver, after departing */
        via: string;
    };
    /** The maneuver the train does after ending service. */
    arrival: {
        /** Where the maneuver ends (e.g., `"Gosforth Depot"`) */
        place: string;
        /** The time the maneuver ends, in "HHMM" format */
        time: string;
        /** A description of the maneuver, after ending service */
        via: string;
    };
    /** In-line timetable for the train. */
    in: Route[];
    /** Out-line timetable for the train. */
    out: Route[];
}

/** Options for the `/timetable` endpoint */
export interface TimetableOptions {
    /** Day of the week (`0`=Monday, `6`=Sunday, defaults to today) */
    day?: number;
    /** Filter by Train Running Number (TRN, without the leading "T", e.g. `"101"`), defaults to all TRNs */
    trn?: string;
    /** Filter by station code. */
    station?: string;
    /**
     * Which directions to include, if any.
     * `"in"` for Airport to South Hylton or St James to South Shields.
     * `"out"` for South Hylton to Airport or South Shields to St James.
     */
    direction?: 'in' | 'out' | 'none';
    /** Which empty maneuvers to include, if any. */
    emptyManeuvers?: 'arrival' | 'departure' | 'none';
    /** Properties to include in the empty maneuvers. */
    emptyManeuverProps?: PropsFilter;
    /** Properties to include in the tables. */
    tableProps?: PropsFilter;
}

/** A table (`in` and `out`) in `/timetable` endpoint response, assuming all properties are present. */
export type FullTimetableResponseTable<IsAllStations extends boolean> =
    TrainTimetable<
        IsAllStations extends true ? AllStationsRoute : SingleStationRoute
    >;

/** A table (`in` and `out`) in the `/timetable` endpoint response. */
export type TimetableResponseTable<IsAllStations extends boolean> =
    RecursivePartial<FullTimetableResponseTable<IsAllStations>>;

/** Response from the `/timetable` endpoint. */
export type TimetableResponse<IsAllTrains extends boolean, IsAllStations extends boolean> =
    IsAllTrains extends true
        ? TimetableResponseTable<IsAllStations>
        : Record<string, TimetableResponseTable<IsAllStations>>;

// --- `/stream` Endpoint ---

/** Base interface for responses from the `/stream` endpoint. */
export interface BaseStreamOptions {
    /** Which types of events to include in the stream. Defaults to all. */
    type?: 'trains' | 'errors';
}

/** Receive all events (default). */
export interface StreamAllOptions extends BaseStreamOptions, FilterableProps {
    type: undefined;
}

/** Only receive new-history events. */
export interface StreamTrainsOptions extends BaseStreamOptions, FilterableProps {
    type: 'trains';
    /** A list of Train Running Numbers (TRNs, without the leading "T", e.g. "101") to receive new-history updates for. */
    trns?: string[];
}

/** Only receive heartbeat-error (and optionally heartbeat-warnings) events. */
export interface StreamErrorsOptions extends BaseStreamOptions {
    type: 'errors';
    /** Whether to also receive warnings. */
    warnings?: boolean;
    /**
     * A list of internal API identifiers to receive errors (and optionally warnings) for.
     * See: https://gist.github.com/hopperelec/c23eb872b83b5584122e61a676394ff3#apis
     */
    apis?: string[];
}

/** Options for the `/stream` endpoint. */
export type StreamOptions = StreamAllOptions | StreamTrainsOptions | StreamErrorsOptions;

/** Payload for the `new-history` SSE event, assuming all properties are present. */
export interface FullNewHistoryPayload {
    date: Date;
    trains: Record<string, Omit<HistoryEntry,"date">>;
}

/** Payload for the `new-history` SSE event. */
export type NewHistoryPayload = RecursivePartial<FullNewHistoryPayload>;

/** Payload for the `heartbeat-error` SSE event. */
export interface HeartbeatErrorPayload {
    /**
     * Identifier of the API that produced the error.
     * See: https://gist.github.com/hopperelec/c23eb872b83b5584122e61a676394ff3#apis
     */
    api: string;
    /** String containing the error message. */
    error: string;
}

/** Payload for the `heartbeat-warnings` SSE event. */
export interface HeartbeatWarningPayload {
    /**
     * Identifier of the API that produced the warning.
     * See: https://gist.github.com/hopperelec/c23eb872b83b5584122e61a676394ff3#apis
     */
    api: string;
    /**
     * The specific warning data.
     * The structure will vary depending on the API that produced the warning.
     * See: https://gist.github.com/hopperelec/c23eb872b83b5584122e61a676394ff3#apis
     */
    warnings: any;
}

// --- Last Seen Parsing ---

/** Possible states shown in the last seen string provided by the train statuses API. */
export type ActiveTrainState = "Approaching" | "Arrived" | "Ready to start" | "Departed";

/** Valid platform numbers. */
export type PlatformNumber = 1 | 2 | 3 | 4;

/** Parts of the last seen string provided by the train statuses API. */
export type ParsedLastSeen = {
    state: ActiveTrainState;
    station: string;
    platform: PlatformNumber;
    hours: number;
    minutes: number;
}
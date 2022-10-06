export declare function getCurrentProposer(): Promise<any>;
export declare function getProposers(): Promise<any>;
export declare function registerProposer({ stake }: {
    stake: any;
}): Promise<void>;
export declare function unregisterProposer(): Promise<void>;
export declare function updateProposer(url: any): Promise<void>;
export declare function changeCurrentProposer(): Promise<void>;

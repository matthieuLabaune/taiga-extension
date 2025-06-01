export interface TaigaProject {
    id: number;
    name: string;
    description: string;
    created: string;
    updated: string;
}

export interface TaigaUser {
    id: number;
    username: string;
    email: string;
    full_name: string;
}

export interface TaigaTask {
    id: number;
    subject: string;
    description: string;
    status: string;
    assigned_to: TaigaUser | null;
    project: TaigaProject;
    created: string;
    updated: string;
}

export interface TaigaApiResponse<T> {
    count: number;
    results: T[];
}
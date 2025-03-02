export interface Video {
    uuid: string;
    name: string;
    category: number;
    licence: number
    language: string
    privacy: number
    nsfw: boolean
    description: string
    support: string
    duration: number
    views: number
    likes: number
    dislikes: number
    remote: boolean
    isLive: boolean
    url: string
    commentsEnabled: boolean
    downloadEnabled: boolean
    waitTranscoding: boolean
    state: number
    inputFileUpdatedAt: Date
    publishedAt: Date
    originallyPublishedAt: Date
    channelId: number
}

import chalk from "chalk";
import { Channel, Playlist, Video, YouTube } from "youtube-sr";

let timeOut: NodeJS.Timeout | undefined = undefined;

export const searchYoutube = (input: string = "", type: string): Promise<{name: string, value: (Channel | Playlist | Video | undefined)}[]> => {
    return new Promise((resolve, reject) => {
        clearTimeout(timeOut)

        timeOut = setTimeout(async () => {
            try {
                const results = await YouTube.search(input, { limit: 5, type: type as 'all' });
                const detail = results.map((result) => {
                    if (result.type === 'channel') {
                        return {name: chalk.red(`Channel: ${result.name} - ${result.subscribers}`), value: result};
                    }
                    if (result.type === 'playlist') {
                        return {name: chalk.blue(`Playlist: ${result.title}`), value: result};
                    }
                    if (result.type === 'video') {
                        return {name: `Video: ${result.title} - ${result.duration}`, value: result};
                    }
                    return {name: '', value: undefined};
                });
                resolve(detail);
            } catch (error) {
                resolve([]);
            }
        }, 1000); // Simulate delay of 1 second
    });
};
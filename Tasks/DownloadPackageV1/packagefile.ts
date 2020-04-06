import * as tl from "azure-pipelines-task-lib/task";
import * as path from "path";
import * as fs from "fs";
import { PackageFileResult } from "./package";
var tar = require("tar-fs");
var zlib = require("zlib");
var DecompressZip = require('decompress-zip');

export class PackageFile {
    // file will be downloaded here
    private initialLocation: string;

    // file will be extracted to this location
    private finalLocation: string;
    private extractFile: boolean;

    public readonly source: PackageFileResult;

    constructor(extract: boolean, destination: string, filename: string, source: PackageFileResult) {
        this.finalLocation = destination;
        this.extractFile = extract;
        this.source = source;

        if (extract) {
            this.initialLocation = path.resolve(tl.getVariable('Agent.TempDirectory'), filename);
        } else {
            this.initialLocation = path.resolve(destination, filename);
        }
    }

    public async process(): Promise<void> {
        if (this.extractFile) {
            await this.extract();
        }
    }

    get downloadPath() {
        return this.initialLocation;
    }

    private async extract(): Promise<void> {
        const fileEnding = path.parse(this.initialLocation).ext;
        switch (fileEnding) {
            case ".zip":
            case ".nupkg":
                await this.unzip(this.initialLocation, this.finalLocation);
                return;
            case ".tgz":
                await this.unTarGz(this.initialLocation, this.finalLocation);
                return;
            default:
                throw new Error(tl.loc("UnsupportedArchiveType", fileEnding));
        }
    }

    private async unTarGz(zipLocation: string, unzipLocation: string): Promise<void> {
        return Promise.resolve(
            fs
                .createReadStream(zipLocation)
                .pipe(zlib.createGunzip())
                .pipe(tar.extract(unzipLocation))
        );
    }

    private async unzip(zipLocation: string, unzipLocation: string): Promise<void> {
        return new Promise<void>(function(resolve, reject) {
            tl.debug("Extracting " + zipLocation + " to " + unzipLocation);

            var unzipper = new DecompressZip(zipLocation);
            unzipper.on("error", err => {
                return reject(tl.loc("ExtractionFailed", err));
            });
            unzipper.on("extract", () => {
                tl.debug("Extracted " + zipLocation + " to " + unzipLocation + " successfully");
                return resolve();
            });

            unzipper.extract({
                path: unzipLocation
            });
        });
    }
}

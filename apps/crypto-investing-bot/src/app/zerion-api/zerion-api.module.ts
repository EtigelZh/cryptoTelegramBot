import { Module } from "@nestjs/common";
import { AppConfigModule } from "../app.config";
import { ZerionApiService } from "./zerion-api.service";

@Module({
    imports: [AppConfigModule],
    providers: [ZerionApiService],
    exports: [ZerionApiService]
})
export class ZerionApiModule {

}
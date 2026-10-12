import { Global, Module } from "@nestjs/common";
import { ActivityStampService } from "./activity-stamp.service";
import { EnrichmentLogService } from "./enrichment-log.service";
import { ViewerService } from "./viewer.service";

@Global()
@Module({
	providers: [ActivityStampService, EnrichmentLogService, ViewerService],
	exports: [ActivityStampService, EnrichmentLogService, ViewerService],
})
export class CrmModule {}

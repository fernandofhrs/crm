import { Module } from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { FieldsModule } from "../fields/fields.module";
import { TrpcModule } from "../trpc/trpc.module";
import { MirrorRouter } from "./mirror.router";
import { MirrorService } from "./mirror.service";

@Module({
	imports: [TrpcModule, FieldsModule, CurrencyModule],
	providers: [MirrorService, MirrorRouter],
})
export class MirrorModule {}

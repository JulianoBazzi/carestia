-- Encarte: preço "de" riscado (fora da média), nulo nas demais fontes.
ALTER TABLE "price_observations" ADD COLUMN "regular_value" DECIMAL(14,4);

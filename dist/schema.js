import { z } from "zod";
export const TW = z.string();
const Assets = z.object({
    headerImage: z.string().url().optional(),
    footerImage: z.string().url().optional(),
    logo: z.string().url().optional()
}).partial().default({});
const PageCfg = z.object({
    size: z.enum(["A4", "Letter"]).default("A4"),
    orientation: z.enum(["portrait", "landscape"]).default("portrait"),
    margin: z.string().default("20mm")
}).strict();
const FontCfg = z.object({
    family: z.string().default("Inter, ui-sans-serif, system-ui"),
    base: z.string().default("text-[12pt]"),
    leading: z.string().default("leading-relaxed")
}).strict();
const HeaderCfg = z.object({
    visible: z.boolean().default(true),
    align: z.enum(["left", "center", "right"]).default("center"),
    repeat: z.enum(["all", "first"]).default("all")
}).strict();
const FooterCfg = z.object({
    visible: z.boolean().default(true),
    text: z.string().default("Page {{page}} of {{pages}}"),
    align: z.enum(["left", "center", "right"]).default("center")
}).strict();
const DateCfg = z.object({
    align: z.enum(["left", "center", "right"]).default("right"),
    format: z.string().default("DD MMM YYYY")
}).strict();
const TableCfg = z.object({
    border: TW.default("border-2"),
    striped: z.boolean().default(true),
    compact: z.boolean().default(false)
}).strict();
export const Configs = z.object({
    page: PageCfg.default({}),
    font: FontCfg.default({}),
    header: HeaderCfg.default({}),
    footer: FooterCfg.default({}),
    date: DateCfg.default({}),
    table: TableCfg.default({})
}).strict();
export const Colors = z.object({
    primary: z.string().default("#0F172A"),
    accent: z.string().default("#2563EB"),
    text: z.string().default("#111827"),
    muted: z.string().default("#6B7280"),
    border: z.string().default("#E5E7EB")
}).strict();
const StyleMap = z.record(z.string(), TW).optional();
const CompBase = z.object({
    type: z.string(),
    style: StyleMap,
    id: z.string().optional()
}).strict();
const HeaderComp = CompBase.extend({
    type: z.literal("header"),
    props: z.object({ text: z.string() }).strict()
});
const SubheaderComp = CompBase.extend({
    type: z.literal("subheader"),
    props: z.object({ text: z.string() }).strict()
});
const DateComp = CompBase.extend({
    type: z.literal("date"),
    props: z.object({ value: z.string().optional() }).strict()
});
const ParaComp = CompBase.extend({
    type: z.literal("para"),
    props: z.object({ text: z.string() }).strict()
});
const DividerComp = CompBase.extend({
    type: z.literal("divider"),
    props: z.object({}).strict()
});
const SpacerComp = CompBase.extend({
    type: z.literal("spacer"),
    props: z.object({ size: z.enum(["xs", "sm", "md", "lg", "xl"]).default("md").optional() }).strict()
});
const PagebreakComp = CompBase.extend({
    type: z.literal("pagebreak"),
    props: z.object({}).strict()
});
const SignatureComp = CompBase.extend({
    type: z.literal("signature"),
    props: z.object({ label: z.string().optional(), lines: z.number().int().min(1).max(5).default(1).optional() }).strict()
});
const FooterTextComp = CompBase.extend({
    type: z.literal("footerText"),
    props: z.object({ text: z.string() }).strict()
});
const TableComp = CompBase.extend({
    type: z.literal("table"),
    props: z.object({
        title: z.string().optional(),
        headers: z.array(z.string()),
        rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
        notes: z.string().optional()
    }).strict()
});
export const Component = z.discriminatedUnion("type", [
    HeaderComp,
    SubheaderComp,
    DateComp,
    ParaComp,
    DividerComp,
    SpacerComp,
    PagebreakComp,
    SignatureComp,
    FooterTextComp,
    TableComp
]);
export const ReportSchema = z.object({
    company: z.string(),
    reportName: z.string(),
    colors: Colors.default({}),
    assets: Assets.default({}),
    configs: Configs.default({}),
    components: z.array(Component).min(1)
}).strict();

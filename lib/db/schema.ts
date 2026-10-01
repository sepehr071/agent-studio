import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import type {
  ActionItem,
  ConfigParams,
  ConfigToolConfig,
  Decision,
  MinutesSegment,
  QAEntry,
  ScribeWord,
} from "@/lib/db/types";
import type { ChatMessage } from "@/lib/tools";

// ---------------------------------------------------------------- conversations

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull().default("New chat"),
    modelId: text("model_id").notNull(),
    // null projectId/folderId ⇒ ungrouped; null configId ⇒ quick model
    projectId: text("project_id"),
    folderId: text("folder_id"),
    configId: text("config_id"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    // Set when a conversation was spawned to discuss a meeting
    originMeetingId: text("origin_meeting_id"),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),
    messageCount: integer("message_count").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("conversations_project_idx").on(table.projectId),
    index("conversations_folder_idx").on(table.folderId),
    index("conversations_config_idx").on(table.configId),
  ],
);

// ---------------------------------------------------------------- messages

export const messages = sqliteTable(
  "messages",
  {
    // Same id as UIMessage.id so onFinish can upsert by id
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    parts: text("parts", { mode: "json" })
      .notNull()
      .$type<ChatMessage["parts"]>(),
    metadata: text("metadata", { mode: "json" }).$type<
      ChatMessage["metadata"]
    >(),
    orderIndex: integer("order_index").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("messages_conversation_order_idx").on(
      table.conversationId,
      table.orderIndex,
    ),
  ],
);

// ---------------------------------------------------------------- settings

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("singleton"),
  defaultModelId: text("default_model_id").notNull(),
  aiPrefsEnabled: integer("ai_prefs_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  userName: text("user_name"),
  outputLanguage: text("output_language"),
  expertiseLevel: text("expertise_level"),
  tone: text("tone"),
  responseStyle: text("response_style"),
  customInstructions: text("custom_instructions"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

// ---------------------------------------------------------------- projects

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    emoji: text("emoji"),
    isPinned: integer("is_pinned", { mode: "boolean" })
      .notNull()
      .default(false),
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("projects_sort_idx").on(table.sortOrder)],
);

// ---------------------------------------------------------------- folders

export const folders = sqliteTable(
  "folders",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    // Self-referencing nested folders
    parentId: text("parent_id"),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("folders_project_idx").on(table.projectId),
    index("folders_parent_idx").on(table.parentId),
  ],
);

// ---------------------------------------------------------------- configs (assistants)

export const configs = sqliteTable(
  "configs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    avatarEmoji: text("avatar_emoji"),
    systemPrompt: text("system_prompt").notNull().default(""),
    modelId: text("model_id").notNull(),
    params: text("params", { mode: "json" }).$type<ConfigParams>(),
    // Per-assistant capabilities: native tool ids + MCP server ids
    toolConfig: text("tool_config", { mode: "json" }).$type<ConfigToolConfig>(),
    isPinned: integer("is_pinned", { mode: "boolean" })
      .notNull()
      .default(false),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("configs_pinned_idx").on(table.isPinned)],
);

// ---------------------------------------------------------------- mcp servers

export const mcpServers = sqliteTable(
  "mcp_servers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    transport: text("transport")
      .notNull()
      .$type<"http" | "sse" | "stdio">(),
    // http/sse transports
    url: text("url"),
    headers: text("headers", { mode: "json" }).$type<Record<string, string>>(),
    // stdio transport
    command: text("command"),
    args: text("args", { mode: "json" }).$type<string[]>(),
    // stdio servers often need API keys passed through the environment
    env: text("env", { mode: "json" }).$type<Record<string, string>>(),
    isEnabled: integer("is_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("mcp_servers_enabled_idx").on(table.isEnabled)],
);

// ---------------------------------------------------------------- knowledge

export const knowledgeFolders = sqliteTable(
  "knowledge_folders",
  {
    id: text("id").primaryKey(),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("knowledge_folders_parent_idx").on(table.parentId)],
);

export const knowledgeItems = sqliteTable(
  "knowledge_items",
  {
    id: text("id").primaryKey(),
    folderId: text("folder_id").references(() => knowledgeFolders.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    sourceConversationId: text("source_conversation_id"),
    sourceMessageId: text("source_message_id"),
    modelId: text("model_id"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    isFavorite: integer("is_favorite", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("knowledge_items_folder_idx").on(table.folderId),
    index("knowledge_items_favorite_idx").on(table.isFavorite),
  ],
);

// ---------------------------------------------------------------- generated images

export const generatedImages = sqliteTable(
  "generated_images",
  {
    id: text("id").primaryKey(),
    prompt: text("prompt").notNull(),
    negativePrompt: text("negative_prompt"),
    modelId: text("model_id").notNull(),
    mode: text("mode").notNull().$type<"t2i" | "i2i">().default("t2i"),
    aspectHint: text("aspect_hint"),
    styleHint: text("style_hint"),
    filePath: text("file_path").notNull(),
    mimeType: text("mime_type").notNull().default("image/png"),
    width: integer("width"),
    height: integer("height"),
    inputImagePaths: text("input_image_paths", { mode: "json" }).$type<
      string[]
    >(),
    isFavorite: integer("is_favorite", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("generated_images_created_idx").on(table.createdAt)],
);

// ---------------------------------------------------------------- prompt templates

export const promptTemplates = sqliteTable(
  "prompt_templates",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull().default("general"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Extracted `{{var}}` names
    variables: text("variables", { mode: "json" }).$type<string[]>(),
    usageCount: integer("usage_count").notNull().default(0),
    isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("prompt_templates_category_idx").on(table.category)],
);

// ---------------------------------------------------------------- meetings

export const meetings = sqliteTable(
  "meetings",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull().default("جلسه بدون عنوان"),
    status: text("status")
      .notNull()
      .$type<
        "uploaded" | "transcribing" | "summarizing" | "done" | "failed" | "cancelled"
      >()
      .default("uploaded"),
    stage: text("stage"),
    audioPath: text("audio_path"),
    language: text("language").notNull().default("fas"),
    durationS: integer("duration_s"),
    numSpeakers: integer("num_speakers"),
    meetingBrief: text("meeting_brief"),
    seriesId: text("series_id"),
    emailTone: text("email_tone"),
    errorMessage: text("error_message"),
    latestSummaryId: text("latest_summary_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("meetings_status_idx").on(table.status),
    index("meetings_series_idx").on(table.seriesId),
    index("meetings_created_idx").on(table.createdAt),
  ],
);

export const meetingSpeakers = sqliteTable(
  "meeting_speakers",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    // Diarization label e.g. "speaker_0"
    speakerId: text("speaker_id").notNull(),
    displayName: text("display_name"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    unique("meeting_speakers_meeting_speaker_uniq").on(
      table.meetingId,
      table.speakerId,
    ),
    index("meeting_speakers_meeting_idx").on(table.meetingId),
  ],
);

export const meetingTranscripts = sqliteTable(
  "meeting_transcripts",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    rawJson: text("raw_json", { mode: "json" }).$type<unknown>(),
    plainText: text("plain_text").notNull().default(""),
    wordsJson: text("words_json", { mode: "json" }).$type<ScribeWord[]>(),
    languageCode: text("language_code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("meeting_transcripts_meeting_idx").on(table.meetingId)],
);

export const meetingSummaries = sqliteTable(
  "meeting_summaries",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    execSummary: text("exec_summary"),
    actionItemsJson: text("action_items_json", { mode: "json" }).$type<
      ActionItem[]
    >(),
    decisionsJson: text("decisions_json", { mode: "json" }).$type<Decision[]>(),
    minutesJson: text("minutes_json", { mode: "json" }).$type<
      MinutesSegment[]
    >(),
    qaJson: text("qa_json", { mode: "json" }).$type<QAEntry[]>(),
    openQuestionsJson: text("open_questions_json", { mode: "json" }).$type<
      string[]
    >(),
    emailSubject: text("email_subject"),
    emailBody: text("email_body"),
    emailTone: text("email_tone"),
    model: text("model"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("meeting_summaries_meeting_idx").on(table.meetingId)],
);

// ---------------------------------------------------------------- meeting series

export const meetingSeries = sqliteTable("meeting_series", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emailTone: text("email_tone"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const meetingSeriesKeyterms = sqliteTable(
  "meeting_series_keyterms",
  {
    id: text("id").primaryKey(),
    seriesId: text("series_id")
      .notNull()
      .references(() => meetingSeries.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    source: text("source")
      .notNull()
      .$type<"manual" | "suggested" | "accepted">()
      .default("manual"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    unique("meeting_series_keyterms_series_term_uniq").on(
      table.seriesId,
      table.term,
    ),
    index("meeting_series_keyterms_series_idx").on(table.seriesId),
  ],
);

export const meetingSeriesSpeakerNames = sqliteTable(
  "meeting_series_speaker_names",
  {
    id: text("id").primaryKey(),
    seriesId: text("series_id")
      .notNull()
      .references(() => meetingSeries.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    unique("meeting_series_speaker_names_series_name_uniq").on(
      table.seriesId,
      table.displayName,
    ),
    index("meeting_series_speaker_names_series_idx").on(table.seriesId),
  ],
);

// ---------------------------------------------------------------- usage logs

export const usageLogs = sqliteTable(
  "usage_logs",
  {
    id: text("id").primaryKey(),
    model: text("model").notNull(),
    provider: text("provider"),
    feature: text("feature")
      .notNull()
      .$type<"chat" | "image" | "meeting" | "enhancer" | "title">(),
    conversationId: text("conversation_id"),
    meetingId: text("meeting_id"),
    imageId: text("image_id"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    cachedTokens: integer("cached_tokens"),
    totalTokens: integer("total_tokens"),
    costUsd: real("cost_usd"),
    generationId: text("generation_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("usage_logs_created_idx").on(table.createdAt),
    index("usage_logs_model_idx").on(table.model),
    index("usage_logs_feature_idx").on(table.feature),
  ],
);

// ---------------------------------------------------------------- uploads

export const uploads = sqliteTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    ext: text("ext"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    filePath: text("file_path").notNull(),
    extractedText: text("extracted_text"),
    extractStatus: text("extract_status")
      .notNull()
      .$type<"ok" | "truncated" | "unavailable" | "error" | "native-pdf">()
      .default("unavailable"),
    conversationId: text("conversation_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("uploads_conversation_idx").on(table.conversationId)],
);

// ---------------------------------------------------------------- row types

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type FolderRow = typeof folders.$inferSelect;
export type ConfigRow = typeof configs.$inferSelect;
export type McpServerRow = typeof mcpServers.$inferSelect;
export type KnowledgeFolderRow = typeof knowledgeFolders.$inferSelect;
export type KnowledgeItemRow = typeof knowledgeItems.$inferSelect;
export type GeneratedImageRow = typeof generatedImages.$inferSelect;
export type PromptTemplateRow = typeof promptTemplates.$inferSelect;
export type MeetingRow = typeof meetings.$inferSelect;
export type MeetingSpeakerRow = typeof meetingSpeakers.$inferSelect;
export type MeetingTranscriptRow = typeof meetingTranscripts.$inferSelect;
export type MeetingSummaryRow = typeof meetingSummaries.$inferSelect;
export type MeetingSeriesRow = typeof meetingSeries.$inferSelect;
export type MeetingSeriesKeytermRow =
  typeof meetingSeriesKeyterms.$inferSelect;
export type MeetingSeriesSpeakerNameRow =
  typeof meetingSeriesSpeakerNames.$inferSelect;
export type UsageLogRow = typeof usageLogs.$inferSelect;
export type UploadRow = typeof uploads.$inferSelect;

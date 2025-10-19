/* =============== MESSAGES CONFIG MODULE =============== */
(function() {
  'use strict';

  window.BANK_IFRAME_ORIGIN = "https://forumscripts.ru";

  window.BankPrefix = {
    ads: "Реклама",
    bank: "Гринготтс"
  };

  window.BankForums = {
    ads: window.FORUMS_IDS?.Ads || [0],
    bank: window.FORUMS_IDS?.Bank || [0],
    personal_posts: window.FORUMS_IDS?.PersonalPosts || [0],
    plot_posts: window.FORUMS_IDS?.PlotPosts || [0]
  };

  window.BankLabel = {
    ads: "— Каждая рекламная листовка",
    banner_mayak: "— Баннер FMV в подписи на Маяке",
    banner_reno: "— Баннер FMV в подписи на Рено",
    first_post: "— Первый пост на профиле",
    message100: "— Каждые 100 сообщений",
    positive100: "— Каждые 100 позитива",
    reputation100: "— Каждые 100 репутации",
    month: "— Каждый игровой месяц",
    personal_posts: "— Каждый личный пост",
    plot_posts: "— Каждый сюжетный пост",
  };

  window.BankPostMessagesType = {
    ads: "ADS_POSTS",
    backup_data: "BACKUP_DATA",
    banner_mayak: "BANNER_MAYAK_FLAG",
    banner_reno: "BANNER_RENO_FLAG",
    comment_info: "COMMENT_INFO",
    coupons: "PERSONAL_DISCOUNTS",
    first_post: "FIRST_POST_FLAG",
    first_post_missed: "FIRST_POST_MISSED_FLAG",
    skin: "SKIN",
    personal_posts: "PERSONAL_POSTS",
    plot_posts: "PLOT_POSTS",
    profile_info: "PROFILE_INFO",
    user_info: "USER_INFO",
    users_list: "USERS_LIST",
  };

  window.BankSkinFieldID = window.SKIN?.LibraryFieldID || 0;

  window.BankSkinPostID = {
    Plashka: window.SKIN?.LibraryPlashkaPostID || [],
    Icon: window.SKIN?.LibraryIconPostID || [],
    Back: window.SKIN?.LibraryBackPostID || [],
    Gift: window.SKIN?.LibraryGiftPostID || []
  };

  if (window.BankMessagesLog) {
    window.BankMessagesLog("✅ [MODULE] messages-config.js loaded");
  }
})();

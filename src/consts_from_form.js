var SITE_URL = location.origin;

var ALLOWED_PARENTS = [
  "https://testfmvoice.rusff.me",   // тест
  "https://followmyvoice.rusff.me"        // прод
];

var GROUP_IDS = {
  Admin: 1,
  Moderator: 2,
  Guest: 3,
  User: 4,
  Player: 5,
  Listener: -1,
  Ads: -2,
  FantasticCreature: -3,
};

var PROFILE_FIELDS = { // дополнительные поля профиля 
  MoneyID: 6,
  MoneyTemplate: 0,
  IconID: 5,
  BackgroundID: 4,
  PlashkaID: 3,
  PlashkaTemplate: `<a id="ID" class="modal-link" data-reveal-id="character">личная страница</a>`,
};

var FIELDS_WITH_HTML = [
  PROFILE_FIELDS.PlashkaID,
  PROFILE_FIELDS.BackgroundID,
  PROFILE_FIELDS.IconID
]; // поля, для которых нужен рендеринг HTML

var EPS_FORUM_INFO = [ // информация по форумам с эпизодами
  { id: 8, type: 'au', status: 'on' },
  { id: 9, type: 'plot', status: 'archived' },
  { id: 5, type: 'personal', status: 'archived' },
  { id: 4, type: 'personal', status: 'off' },
];

var FORUMS_IDS = { // информация о соответствии форумов конкретным задачам
  Ams: [6], // форумы для админов
  Ads: [3], //  форумы с рекламными листовками
  Bank: [1], // форумы с банком
  PersonalPosts: EPS_FORUM_INFO.filter(item => item.type !== 'plot').map(item => item.id), // форумы с несюжетными постами
  PlotPosts: EPS_FORUM_INFO.filter(item => item.type === 'plot').map(item => item.id), // форумы с сюжетными постами
  NewForm: [10] // форумы с анкетами на проверке
};

var EX_PROFILES = { // информация, где храним админский список удаленных для работы хроно
  topicID: 31,
  commentID: 117
};

var CHRONO_CHECK = {
  GroupID: [GROUP_IDS.Admin],  // кому из групп разрешено использовать сбор хроно
  AllowedUser: [], // или кому из юзеров разрешено использовать сбор хроно
  ForumID: EPS_FORUM_INFO.map(item => item.id), // в каких форумах работает вставка с тегами
  AmsForumID: FORUMS_IDS.Ams, // в каком форуме расположены админские темы
  ChronoTopicID: 13, // в каком теме расположен сбор хроно
  TotalChronoPostID: 83, // в каком посте расположен сбор общего хроно
  PerPersonChronoPostID: 92, // в каком посте расположен сбор хроно по персонажам
  EpisodeMapType: { // отображение типов форумов с эпизодами
    'personal': ['personal', 'black'],
    'plot': ['plot', 'black'],
    'au': ['au', 'black'],
  },
  EpisodeMapStat: { // отображение статусов форумов с эпизодами
    'on': ['active', 'green'],
    'off': ['closed', 'teal'],
    'archived': ['archived', 'maroon'],
  },
  ForumInfo: EPS_FORUM_INFO,
};

var PROFILE_CHECK = { // для работы проверки анкет
  GroupID: [GROUP_IDS.Admin],  // кому из групп разрешено проводить проверку анкет
  GroupUserID: GROUP_IDS.User, // ID группы 'Пользователь'
  GroupPlayerID: GROUP_IDS.Player, // ID группы ''Игрок'
  ForumID: FORUMS_IDS.NewForm,  // в каких форумах работает вставка с кнопками
  PPageTemplate: `<div class="character"><div class="modal_script" data-id="N" data-main-user_id="УБРАТЬ ЕСЛИ НЕ НУЖНО">

<div class="chrono_info"></div>

<div class="_gift"></div>

<div class="_plashka"></div>

<div class="_icon"></div>

<div class="_background"></div>

<div class="_coupon"></div>

</div></div>`, // шаблон персональной страницы
  PPageGroupID: [GROUP_IDS.Admin, GROUP_IDS.Moderator, GROUP_IDS.User, GROUP_IDS.Player], // каким группам видна персональная страница
  PPageFieldID: PROFILE_FIELDS.PlashkaID, // поле с плашкой
  PPageFieldTemplate: PROFILE_FIELDS.PlashkaTemplate, // шаблон для плашки
  MoneyFieldID: PROFILE_FIELDS.MoneyID, // поле с денежками,
  MoneyFieldTemplate: PROFILE_FIELDS.MoneyTemplate, // шаблон для денежек
};

var BANK_CHECK = { // для проверки банковских операций
  GroupID: [GROUP_IDS.Admin], // кому из групп разрешено проверять банк
  UserID: [2], // кому из юзеров из этих групп разрешено проверять банк
  ForumID: FORUMS_IDS.Bank, // форум, где лежит банк
};

var SKIN = { // для работы с библиотекой скинов
  GroupID: [GROUP_IDS.Admin], // кому из групп разрешено назначать в хранилище скины
  LibraryForumID: FORUMS_IDS.Ams, //  // в каком форуме расположены админские темы
  LibraryFieldID: 41, // ID темы с библиотекой
  LibraryGiftPostID: [133], // ID комментариев с подарками
  LibraryPlashkaPostID: [134], // ID комментариев с плашками
  LibraryIconPostID: [135], // ID комментариев с иконками
  LibraryBackPostID: [136], // ID комментариев с фонами
  LibraryCouponPostID: [222], // ID комментариев с купонами
  LogFieldID: 55, // ID темы, где хранятся логи скинов
  PlashkaFieldID: PROFILE_FIELDS.PlashkaID, // ID поля с плашками в профиле
  IconFieldID: PROFILE_FIELDS.IconID, // ID поля с иконками в профиле
  BackFieldID: PROFILE_FIELDS.BackgroundID, // ID поля с фонами в профиле 
};
const json = '../data/anime.json';	// JSONファイルのパス

/* JSON読込 (XMLHttpRequest) */
const request = new XMLHttpRequest();
request.open('GET', json);
request.responseType = 'json';
request.send();

/* JSON -> Object */
request.onload = () => {
  let data = request.response;
  data = JSON.parse(JSON.stringify(data));
  display(data); // 表示
}

/* 表示 */
const display = (data) => {
  const anime = document.getElementById('anime_inner');
  const ul = document.createElement('ul');

  ul.className = 'anime_list';

  for (let i = 0; i < data.anime.length; i++) {
    ul.appendChild(createHTML(data.anime[i]));
  }

  anime.appendChild(ul);
}

/* HTML生成 */
const createHTML = (data) => {

  // 親要素
  const li = document.createElement('li');

  // 子要素
  const ranking = document.createElement('p');
  const category = document.createElement('p');
  const title = document.createElement('h2');
  const comment = document.createElement('p');
  const star = document.createElement('p');
  const year = document.createElement('p');
  const url = document.createElement('a');

  // テキスト
  ranking.textContent = data.ranking ? `${data.ranking} 位` : '　';
  category.textContent = data.category;
  title.textContent = data.title;
  comment.textContent = data.comment;
  star.textContent = `評価 ${data.star}`;
  year.textContent = `公開年 ${data.year}`;
  url.textContent = data.url;
  url.href = data.url;

  // クラス
  li.className = 'anime_item';
  ranking.className = 'anime_ranking';
  url.className = 'anime_url';

  // 子要素を親要素に追加
  li.appendChild(ranking);
  li.appendChild(category);
  li.appendChild(title);
  li.appendChild(comment);
  li.appendChild(star);
  li.appendChild(year);
  li.appendChild(url);

  return li;
}

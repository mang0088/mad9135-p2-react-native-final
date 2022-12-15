import { FlatList } from 'react-native';
import { useState, useEffect } from 'react';
import ListItem from './ListItem';

function ListScreen({ navigation }) {
  const [list, setList] = useState([]);
  // const [search, setSearch] = useState([]);

  useEffect(() => {
    fetch(
      `https://api.spoonacular.com/recipes/search?apiKey=5782988b879f48a49193d80c856ef1e8&query=pasta/`
    )
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => {
        setList(data.results);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  if (!list) {
    return null;
  }
  return (
    <FlatList
      data={list}
      renderItem={({ item }) => (
        <ListItem
          list={item}
          onPress={() => navigation.navigate('Detail', { id: item.id })}
        />
      )}
      keyExtractor={(item) => item.id}
    />
  );
}

export default ListScreen;

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';

const CDN_BASE = 'https://img.spoonacular.com/recipes/';

function ListItem({ list, onPress }) {
  // The list endpoint returns the image file name in `list.image`. Building a
  // URL from `list.id` returned a different (wrong) image, so the cards looked
  // empty. Fall back to the bundled placeholder if the image is missing or
  // fails to load.
  const [imageFailed, setImageFailed] = useState(false);
  const hasRemoteImage = Boolean(list.image) && !imageFailed;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.cardContainer}>
        <Image
          style={styles.imageStyle}
          source={
            hasRemoteImage
              ? { uri: `${CDN_BASE}${list.image}` }
              : require('../assets/placeholder.png')
          }
          onError={() => setImageFailed(true)}
        />
        <View style={styles.infoStyle}>
          <Text style={styles.titleStyle}>{list.title}</Text>
          <View style={styles.lineStyle} />
          <Text style={styles.categoryStyle}>
            <Text style={{ fontWeight: '500' }}>Ready in </Text>{' '}
            {list.readyInMinutes} Minutes
          </Text>
          <Text style={styles.categoryStyle}>
            <Text style={{ fontWeight: '500' }}>Servings </Text> {list.servings}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const deviceWidth = Math.round(Dimensions.get('window').width);
const offset = 40;
const radius = 20;
const styles = StyleSheet.create({
  container: {
    width: deviceWidth - 20,
    alignItems: 'center',
    marginTop: 25,
    paddingLeft: 15,
  },
  cardContainer: {
    width: deviceWidth - offset,
    backgroundColor: '#2596be',
    height: 360,
    marginTop: 25,
    borderRadius: radius,

    shadowColor: '#000',
    shadowOffset: {
      width: 5,
      height: 5,
    },
    shadowOpacity: 0.75,
    shadowRadius: 5,
    elevation: 9,
  },
  imageStyle: {
    height: 200,
    width: deviceWidth - offset,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    opacity: 0.9,
    alignContent: 'center',
    alignSelf: 'center',
  },
  lineStyle: {
    borderWidth: 0.5,
    borderColor: 'black',
    margin: 10,
  },
  titleStyle: {
    textAlign: 'center',
    fontFamily: 'Cochin',
    fontSize: 24,
    fontWeight: '800',
  },
  categoryStyle: {
    fontFamily: 'Gill Sans',
    fontSize: 18,
    fontWeight: '300',
    textAlign: 'center',
  },
  infoStyle: {
    marginHorizontal: 10,
    marginVertical: 5,
  },
});

export default ListItem;

/**
 * React Native Vector Icons 类型声明
 */

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { Component } from 'react';
  export default class MaterialCommunityIcons extends Component<{
    name: string;
    size?: number;
    color?: string;
  }> {}
}

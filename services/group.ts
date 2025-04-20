import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Group {
  groupID: string;
  groupName: string;
}

export interface GroupMember {
  groupID: string;
  userID: string;
  memberRole: "LEADER" | "MEMBER";
}

export const createGroup = async (data: { groupName: string; userID: string }): Promise<Group> => {
  try {
    const response = await api.post("/api/group", data);
    const groupData = response.data.group;
    // Lưu thông tin nhóm vào AsyncStorage
    const storedGroups = await AsyncStorage.getItem("userGroups");
    const groups: Group[] = storedGroups ? JSON.parse(storedGroups) : [];
    const newGroup: Group = { groupID: groupData.groupID, groupName: groupData.groupName };
    const groupExists = groups.some((g) => g.groupID === groupData.groupID);
    if (!groupExists) {
      groups.push(newGroup);
      await AsyncStorage.setItem("userGroups", JSON.stringify(groups));
      console.log("Đã lưu nhóm vào AsyncStorage:", newGroup);
    }
    return newGroup; // Trả về đúng kiểu Group
  } catch (error: any) {
    console.error("Lỗi khi tạo nhóm:", error.message);
    throw error;
  }
};

export const fetchUserGroups = async (userID: string): Promise<Group[]> => {
  try {
    const response = await api.get(`/api/group/${userID}`);
    console.log("Dữ liệu từ API /api/group/:userID:", response.data);
    if (!response.data || !Array.isArray(response.data)) {
      console.error("Dữ liệu trả về không phải mảng:", response.data);
      return [];
    }
    // Lấy danh sách nhóm từ AsyncStorage
    const storedGroups = await AsyncStorage.getItem("userGroups");
    const localGroups: Group[] = storedGroups ? JSON.parse(storedGroups) : [];

    // Kết hợp dữ liệu từ API và AsyncStorage
    const groups = response.data.map((item: { groupID: string }) => {
      const localGroup = localGroups.find((g) => g.groupID === item.groupID);
      return {
        groupID: item.groupID,
        groupName: localGroup ? localGroup.groupName : "Nhóm không tên",
      };
    });
    console.log("Danh sách nhóm sau khi kết hợp:", groups);
    return groups;
  } catch (error: any) {
    console.error("Lỗi khi lấy danh sách nhóm:", error.message);
    return [];
  }
};